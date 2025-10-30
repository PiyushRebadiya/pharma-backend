const { errorMessage, getCommonKeys, successMessage } = require("../common/main");
const { pool } = require("../sql/connectToDatabase");

const updateCanvasEventAndCategory_TicketLimit = async (req, res) => {
    const payload = req.body; // Assuming payload is sent in request body
    let transaction;

    try {
        // Validate payload
        if (!Array.isArray(payload)) {
            return res.status(400).json(errorMessage("Payload must be an array"));
        }

        if (payload.length === 0) {
            return res.status(400).json(errorMessage("Payload cannot be empty"));
        }

        // Check if all EventUkeyId values are the same
        const firstEventId = payload[0].EventUkeyId;
        const allSameEvent = payload.every(item => item.EventUkeyId === firstEventId);

        if (!allSameEvent) {
            return res.status(400).json(errorMessage("All items in payload must have the same EventUkeyId"));
        }

        // Calculate total ticket limit
        const totalTicketLimit = payload.reduce((sum, item) => sum + (item.TicketLimits || 0), 0);

        transaction = pool.transaction();
        await transaction.begin();

        // 1. Update EventMaster with total ticket limit
        const updateEventQuery = `
            UPDATE EventMaster 
            SET TicketLimit = ${totalTicketLimit}
            WHERE EventUkeyId = '${firstEventId}';
        `;

        await transaction.request().query(updateEventQuery);

        const updateFirstEventCategoryPermissionRow = `SELECT TOP 1
                                                        EventId,
                                                        EventUkeyId,
                                                        EventStatus,
                                                        EventName,
                                                        TicketLimit,
                                                        EntryDate,
                                                        SeatArrangment
                                                    FROM EventMasterPermission
                                                    WHERE EventUkeyId = '${firstEventId}'
                                                    ORDER BY EntryDate DESC
                                                    `

        const resultOfFirstEventPermissionRow = await transaction.request().query(updateFirstEventCategoryPermissionRow);

        if (resultOfFirstEventPermissionRow.recordset.length > 0) {
            const { EventId } = resultOfFirstEventPermissionRow.recordset[0];

            const updateEventPermissionFirstRow = `UPDATE EventMasterPermission SET TicketLimit = ${totalTicketLimit} WHERE EventId = ${EventId}`;
            await transaction.request().query(updateEventPermissionFirstRow);
        }


        // 2. Update each ticket category
        let obj = [];
        for (const item of payload) {
            const { TicketCateUkeyId, TicketLimits, PaidLimit, UnPaidLimit, EventUkeyId } = item;
            obj.push(item);

            if (!TicketCateUkeyId) {
                await transaction.rollback();
                return res.status(400).json(errorMessage("TicketCateUkeyId is required for all items"));
            }

            const updateTicketCategoryQuery = `
                UPDATE TicketCategoryMaster 
                SET 
                    TicketLimits = ${TicketLimits || 0},
                    PaidLimit = ${PaidLimit || 0},
                    UnPaidLimit = ${UnPaidLimit || 0}
                WHERE 
                    TicketCateUkeyId = '${TicketCateUkeyId}' 
                    AND EventUkeyId = '${EventUkeyId}';
            `;

            await transaction.request().query(updateTicketCategoryQuery);
        }

        // 3. Update TicketCategoryPermission
        for (const item of payload) {
            const updateFirstEventCategoryPermissionRow = `SELECT TOP 1
                                                        Id,
                                                        TicketLimits,
                                                        PaidLimit,
                                                        UnPaidLimit
                                                    FROM TicketCategoryMasterPermission
                                                    WHERE TicketCateUkeyId = '${item.TicketCateUkeyId}'
                                                    ORDER BY EntryDate DESC
                                                    `

            const resultOfFirstEventPermissionRow = await transaction.request().query(updateFirstEventCategoryPermissionRow);

            if (resultOfFirstEventPermissionRow.recordset.length > 0) {
                const { Id } = resultOfFirstEventPermissionRow.recordset[0];
                const findObj = obj.find(o => o.TicketCateUkeyId === item.TicketCateUkeyId);
                const { TicketLimits, PaidLimit, UnPaidLimit } = findObj;

                const updateTicketCategoryPermissionQuery = `
                    UPDATE TicketCategoryMasterPermission 
                    SET 
                        TicketLimits = ${TicketLimits || 0},
                        PaidLimit = ${PaidLimit || 0},
                        UnPaidLimit = ${UnPaidLimit || 0}
                    WHERE Id = ${Id}
                `;

                await transaction.request().query(updateTicketCategoryPermissionQuery);
            }
        }

        await transaction.commit();

        return res.status(200).json({
            ...successMessage("Ticket limits updated successfully"),
            totalTicketLimit,
            updatedCategories: payload.length
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.log("Update Ticket Limits Error:", error);
        return res.status(500).send(errorMessage(error?.message || "Internal Server Error"));
    }
};

module.exports = {
    updateCanvasEventAndCategory_TicketLimit
};
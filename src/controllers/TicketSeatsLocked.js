const { checkKeysAndRequireValues, errorMessage, setSQLStringValue, successMessage } = require("../common/main");
const { pool } = require("../sql/connectToDatabase");

const addTicketSeatLocked = async (req, res) => {
    let transaction;
    try {
        const { OrganizerUkeyId = '', EventUkeyId, UserUkeyId = '', SeatNumbers } = req.body;
        
        // Check required fields
        const fieldCheck = checkKeysAndRequireValues(['EventUkeyId', 'SeatNumbers'], req.body);
        if (fieldCheck.length !== 0) {
            return res.status(400).send(errorMessage(`${fieldCheck} is required`));
        }

        // Validate SeatNumbers is an array
        if (!Array.isArray(SeatNumbers) || SeatNumbers.length === 0) {
            return res.status(400).send(errorMessage('SeatNumbers must be a non-empty array'));
        }

        // Start transaction
        transaction = await pool.transaction();
        await transaction.begin();

        // Check ALL seats first before inserting any (case-sensitive comparison)
        const alreadyLockedSeats = [];
        
        for (const seatNumber of SeatNumbers) {
            const checkQuery = `
                SELECT Id FROM TicketSeatLocked 
                WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)} 
                AND BINARY_CHECKSUM(SeatNumber) = BINARY_CHECKSUM(${setSQLStringValue(seatNumber)})
            `;
            
            const existingRecord = await transaction.request().query(checkQuery);
            
            if (existingRecord.recordset.length > 0) {
                alreadyLockedSeats.push(seatNumber);
            }
        }

        // If ANY seats are already locked, rollback and return error
        if (alreadyLockedSeats.length > 0) {
            await transaction.rollback();
            return res.status(400).send({
                ...errorMessage(`Cannot lock seats. The following seats are already locked: ${alreadyLockedSeats.join(', ')}`),
                details: {
                    alreadyLockedSeats,
                    requestedSeats: SeatNumbers
                }
            });
        }

        // Insert ALL seats
        const insertedSeats = [];
        
        for (const seatNumber of SeatNumbers) {
            const insertQuery = `
                INSERT INTO TicketSeatLocked 
                (OrganizerUkeyId, EventUkeyId, UserUkeyId, SeatNumber) 
                VALUES 
                (${setSQLStringValue(OrganizerUkeyId)}, 
                 ${setSQLStringValue(EventUkeyId)}, 
                 ${setSQLStringValue(UserUkeyId)}, 
                 ${setSQLStringValue(seatNumber)})
            `;

            const result = await transaction.request().query(insertQuery);
            
            if (result?.rowsAffected[0] === 1) {
                insertedSeats.push(seatNumber);
            } else {
                // If any insert fails, throw error to trigger rollback
                throw new Error(`Failed to insert seat: ${seatNumber}`);
            }
        }

        // Commit transaction if all inserts succeeded
        await transaction.commit();

        return res.status(200).send({
            ...successMessage('All seats locked successfully!'),
            data: {
                OrganizerUkeyId,
                EventUkeyId,
                UserUkeyId,
                lockedSeats: insertedSeats,
                totalSeatsLocked: insertedSeats.length
            }
        });

    } catch (error) {
        console.log('Add TicketSeatLocked Error:', error);
        
        // Rollback transaction if it exists
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.log('Transaction rollback error:', rollbackError);
            }
        }
        
        // Handle unique constraint violation (shouldn't occur with our check, but just in case)
        if (error?.number === 2627 || error?.message?.includes('UNIQUE KEY constraint')) {
            return res.status(400).send(errorMessage('One or more seats are already locked for this event'));
        }
        
        // Handle specific error messages
        if (error.message.includes('Failed to insert seat')) {
            return res.status(400).send(errorMessage(error.message));
        }
        
        return res.status(400).send(errorMessage(error?.message || 'Failed to lock seats'));
    }
};
const verifyTicketSeatLocked = async (req, res) => {
    const { EventUkeyId, SeatNumbers } = req.body;
    
    // Check required fields
    const fieldCheck = checkKeysAndRequireValues(['EventUkeyId', 'SeatNumbers'], req.body);
    if (fieldCheck.length !== 0) {
        return res.status(400).send(errorMessage(`${fieldCheck} is required`));
    }

    // Validate SeatNumbers is an array
    if (!Array.isArray(SeatNumbers) || SeatNumbers.length === 0) {
        return res.status(400).send(errorMessage('SeatNumbers must be a non-empty array'));
    }

    let transaction;
    try {
        // Create transaction
        transaction = await pool.transaction();
        await transaction.begin();

        const notLockedSeats = [];

        // Check ALL seats first before any operations
        for (const seatNumber of SeatNumbers) {
            const checkQuery = `
                SELECT Id FROM TicketSeatLocked 
                WHERE EventUkeyId = ${setSQLStringValue(EventUkeyId)} 
                AND BINARY_CHECKSUM(SeatNumber) = BINARY_CHECKSUM(${setSQLStringValue(seatNumber)})
            `;

            const existingRecord = await transaction.request().query(checkQuery);

            if (existingRecord.recordset.length === 0) {
                notLockedSeats.push(seatNumber);
            }
        }

        // If ANY seats are not locked, rollback and return error
        if (notLockedSeats.length > 0) {
            await transaction.rollback();
            return res.status(400).send({
                ...errorMessage(`The following seats are not locked: ${notLockedSeats.join(', ')}`),
                details: {
                    notLockedSeats,
                    requestedSeats: SeatNumbers
                }
            });
        }

        // If all seats are locked, commit the transaction
        await transaction.commit();

        return res.status(200).send(successMessage('All seats are verified as locked successfully!'));

    } catch (error) {
        // Rollback transaction in case of any error
        if (transaction) {
            await transaction.rollback();
        }
        
        console.error('Error verifying seat locks:', error);
        return res.status(500).send(errorMessage('Failed to verify seat locks due to server error'));
    }
};

module.exports = {
    addTicketSeatLocked,
    verifyTicketSeatLocked
}
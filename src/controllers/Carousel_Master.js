const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, deleteImage, setSQLOrderId, setSQLStringValue, setSQLNumberNullValue, setSQLDateTime, CommonLogFun } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');
const { autoVerifyCarousel } = require("./autoRunQuery");

const fetchCarouselList = async (req, res) => {
    try {
        const { CarouselUkeyId, EventUkeyId, OrganizerUkeyId, IsActive } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (CarouselUkeyId) {
            whereConditions.push(`cc.CarouselUkeyId = ${setSQLStringValue(CarouselUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`cc.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (IsActive) {
            whereConditions.push(`cc.IsActive = ${setSQLBooleanValue(IsActive)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`cc.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        whereConditions.push(`cc.flag <> 'D'`);
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getCarouselList = {
            getQuery: `SELECT 
            cc.*, 
            ( 
                SELECT dm.FileName, dm.Label, dm.DocUkeyId, dm.EventUkeyId, dm.OrganizerUkeyId, dm.Category
                FROM DocumentUpload dm 
                WHERE dm.UkeyId = cc.CarouselUkeyId 
                FOR JSON PATH 
            ) AS FileNames,
            om.OrganizerName, om.Mobile1
        FROM Carousel AS cc 
        left join OrganizerMaster om on om.OrganizerUkeyId = cc.OrganizerUkeyId
        ${whereString}
        ORDER BY 
            CASE 
                WHEN cc.OrderId IS NULL THEN 1 ELSE 0 
            END,
            cc.OrderId ASC, 
            cc.CarouselId DESC
        `,
            countQuery: `SELECT COUNT(*) AS totalCount FROM Carousel As cc ${whereString}`,
        };
        const result = await getCommonAPIResponse(req, res, getCarouselList);
        if(result?.data?.length > 0){
            result.data.forEach(event => {
                if(event.FileNames){
                    event.FileNames = JSON.parse(event?.FileNames)
                } else {
                    event.FileNames = []
                }
            });
        }
        return res.json(result);

    } catch (error) {
        return res.status(500).send(errorMessage(error?.message));
    }
};

const CarouserMaster = async (req, res) => {
    const { CarouselUkeyId, EventUkeyId, OrganizerUkeyId, Title, IsActive, OrderId, Link, StartEventDate, EndEventDate, AlwaysShow, LinkType, flag } = req.body;
    
    try {
        const missingKeys = checkKeysAndRequireValues(['CarouselUkeyId'], { ...req.body });
        if (missingKeys.length > 0) {
            return res.status(400).send(`${missingKeys.join(', ')} is required`);
        }
    
        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);
        
        const ActiveImagesCount = await pool.request().query(`select COUNT(*) ActiveCarouselCount from Carousel where IsActive = 1 and flag <> 'D' `)
        const ActiveImageCount = IsActive ? ActiveImagesCount.recordset[0]?.ActiveCarouselCount + 1 : ActiveImagesCount.recordset[0]?.ActiveCarouselCount
        if(ActiveImageCount > 10){
            return res.status(400).json(errorMessage('Max 10 Active images allowed in the carousel!'))
        }

        const getCarouselCountOnEvent = await pool.request().query(`select COUNT(*) AS EventCarouselCount from Carousel where EventUkeyId = ${setSQLStringValue(EventUkeyId)} and flag <> 'D'`)

        if(getCarouselCountOnEvent.recordset?.[0].EventCarouselCount >= 1 && flag == 'A'){
            return res.status(400).json(errorMessage(`Only one Advertisement image is allowed per event.`));
        }

        let query = ''

        if (flag === 'U') {
            query += `DELETE FROM Carousel WHERE CarouselUkeyId = ${setSQLStringValue(CarouselUkeyId)}`
        }

        query += `
            INSERT INTO Carousel (
                CarouselUkeyId, EventUkeyId, OrganizerUkeyId, Title, IsActive, OrderId, Link, StartEventDate, EndEventDate, AlwaysShow, LinkType, IpAddress, HostName, EntryDate, flag
            ) VALUES (
                ${setSQLStringValue(CarouselUkeyId)}, ${setSQLStringValue(EventUkeyId)}, ${setSQLStringValue(OrganizerUkeyId)}, ${setSQLStringValue(Title)}, ${setSQLStringValue(IsActive)}, ${setSQLStringValue(OrderId)}, ${setSQLStringValue(Link)}, ${setSQLDateTime(StartEventDate)}, ${setSQLDateTime(EndEventDate)}, ${setSQLStringValue(AlwaysShow)}, ${setSQLStringValue(LinkType)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(flag)}
            )
        `;

        const result = await pool.request().query(query);

        if (result?.rowsAffected?.[0] === 0) {
            return res.status(200).json(successMessage(`NO Carousel Successfully.`));
        }

        CommonLogFun({
            EventUkeyId : EventUkeyId,
            OrganizerUkeyId : OrganizerUkeyId, 
            ReferenceUkeyId : CarouselUkeyId, 
            MasterName : Title,  
            TableName : "Carousel", 
            UserId : req.user.UserId, 
            UserName : req.user.FirstName, 
            IsActive : IsActive,
            flag : flag, 
            IPAddress : IPAddress, 
            ServerName : ServerName, 
            EntryTime : EntryTime
        })

        return res.status(200).json(successMessage(`Carousel Master ${flag == 'A' ? 'Created' : 'update'} Successfully.`));
    } catch (error) {
        return res.status(500).json(errorMessage(error.message));
    }
};

const RemoveCarousel = async (req, res) => {
    try {
        const { CarouselUkeyId, EventUkeyId, OrganizerUkeyId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['CarouselUkeyId', 'EventUkeyId', 'OrganizerUkeyId'], req.query);
        if (missingKeys.length > 0) {
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const deleteQuery = `
            update Carousel set flag = 'D' WHERE CarouselUkeyId = ${setSQLStringValue(CarouselUkeyId)} and EventUkeyId = ${setSQLStringValue(EventUkeyId)} and OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}
        `;
        const deleteResult = await pool.request().query(deleteQuery);

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(400).json(errorMessage('No Carousel Deleted.'));
        }

        return res.status(200).json(successMessage('Carousel Deleted Successfully.'));
    } catch (error) {
        console.error('Delete Carousel Master Error:', error);
        return res.status(500).json(errorMessage(error.message));
    }
};

module.exports = {
    fetchCarouselList,
    CarouserMaster,
    RemoveCarousel
}
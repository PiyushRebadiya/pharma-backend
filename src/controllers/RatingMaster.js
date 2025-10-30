const { errorMessage, successMessage, checkKeysAndRequireValues, generateCODE, setSQLBooleanValue, getCommonKeys, generateJWTT, generateUUID, getCommonAPIResponse, setSQLStringValue, setSQLNumberValue } = require("../common/main");
const {pool} = require('../sql/connectToDatabase');

const fetchRatings = async (req, res)=>{
    try{
        const { ReviewUkeyId, Star, UserUkeyId, EventUkeyId, OrganizerUkeyId } = req.query;
        let whereConditions = [];

        // Build the WHERE clause based on the Status
        if (ReviewUkeyId) {
            whereConditions.push(`rr.ReviewUkeyId = ${setSQLStringValue(ReviewUkeyId)}`);
        }
        if (UserUkeyId) {
            whereConditions.push(`rr.UserUkeyId = ${setSQLStringValue(UserUkeyId)}`);
        }
        if (EventUkeyId) {
            whereConditions.push(`rr.EventUkeyId = ${setSQLStringValue(EventUkeyId)}`);
        }
        if (OrganizerUkeyId) {
            whereConditions.push(`rr.OrganizerUkeyId = ${setSQLStringValue(OrganizerUkeyId)}`);
        }
        if (Star) {
            whereConditions.push(`rr.Star = ${setSQLStringValue(Star)}`);
        }
        // Combine the WHERE conditions into a single string
        const whereString = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const getUserList = {
            getQuery: `
            select rr.*, um.FullName AS UserName, em.EventName, om.OrganizerName from RatingMaster rr
            left join EventMaster em on rr.EventUkeyId = em.EventUkeyId
            left join OrganizerMaster om on rr.OrganizerUkeyId = om.OrganizerUkeyId
            left join UserMaster um on rr.UserUkeyId = um.UserUkeyId 
            ${whereString} ORDER BY rr.EntryDate DESC`,
            countQuery: `SELECT COUNT(rr.Id) AS totalCount FROM RatingMaster rr ${whereString}`,
        };

        const result = await getCommonAPIResponse(req, res, getUserList);

        return res.json({
            ...result,
        });
    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const countOfRatingAndsubscriber = async ( req, res) => {
    try{
        const { EventUkeyId, OrganizerUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['EventUkeyId', 'OrganizerUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')}, is required`))
        }

        const subscriberResult = await pool.request().query(`
        select count(SubscriberUkeyId) as TotalSubscriber from SubscriberMaster where OrganizerUkeyId=${setSQLStringValue(OrganizerUkeyId)} and EventUkeyId=${setSQLStringValue(EventUkeyId)} and IsSubscribe=1
        `)
        const ratingResult = await pool.request().query(`
        select COUNT(UserUkeyId) as TotalUserRating, CEILING(AVG(CAST(Star AS FLOAT))) AS AvgRating from RatingMaster where
        OrganizerUkeyId=${setSQLStringValue(OrganizerUkeyId)}
        and EventUkeyId=${setSQLStringValue(EventUkeyId)}
        `)

        return res.json({
            TotalSubscriber : subscriberResult.recordset?.[0].TotalSubscriber,
            TotalUserRating : ratingResult.recordset?.[0]?.TotalUserRating,
            AvgRating : ratingResult.recordset?.[0]?.AvgRating
        });
    }catch(error){
        return res.status(400).send(errorMessage(error?.message));
    }
}

const RatingMaster = async (req, res)=>{
    const { ReviewUkeyId, ReviewDetail, Star, UserUkeyId, EventUkeyId, OrganizerUkeyId, flag} = req.body;
    
    try{
        const missingKeys = checkKeysAndRequireValues(['ReviewUkeyId', 'UserUkeyId'], req.body);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')}, is required`))
        }
        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);

        const insertQuery = `
            INSERT INTO RatingMaster (ReviewUkeyId, EventUkeyId, OrganizerUkeyId, UserUkeyId, ReviewDetail, Star, IpAddress, HostName, EntryDate, flag) VALUES (
            ${setSQLStringValue(ReviewUkeyId)}, 
            ${setSQLStringValue(EventUkeyId)}, 
            ${setSQLStringValue(OrganizerUkeyId)},
            ${setSQLStringValue(UserUkeyId)}, 
            ${setSQLStringValue(ReviewDetail)}, 
            ${setSQLNumberValue(Star)}, 
            ${setSQLStringValue(IPAddress)},
            ${setSQLStringValue(ServerName)},
            ${setSQLStringValue(EntryTime)},
            ${setSQLStringValue(flag)}
            );
        `

        const deleteQuery = `
            DELETE FROM RatingMaster WHERE ReviewUkeyId = '${ReviewUkeyId}';
        `

        if(flag == 'A'){

            const result = await pool.request().query(insertQuery);
                
            if(result.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Rating Created.'),})
            }
    
            return res.status(200).json({...successMessage('New Rating Created Successfully.'), ...req.body, ReviewUkeyId});

        }else if(flag === 'U'){

            const deleteResult = await pool.request().query(deleteQuery);
            const insertResult = await pool.request().query(insertQuery);

            if(deleteResult.rowsAffected[0] === 0 && insertResult.rowsAffected[0] === 0){
                return res.status(400).json({...errorMessage('No Rating Updated.')})
            }
    
            return res.status(200).json({...successMessage('Rating Updated Successfully.'), ...req.body, ReviewUkeyId});
        }else{
            return res.status(400).json({...errorMessage("Use 'A' flag to Add and 'U' flag to update, it is compulsary to send flag.")});
        }
    }catch(error){
        if(flag === 'A'){
            console.log('Add Rating Error :', error);
        }
        if(flag === 'U'){
            console.log('Update Rating Error :', error);
        }
        return res.status(500).send(errorMessage(error?.message));
    }
}

const RemoveRating = async (req, res) => {
    try{
        const {ReviewUkeyId} = req.query;

        const missingKeys = checkKeysAndRequireValues(['ReviewUkeyId'], req.query);

        if(missingKeys.length > 0){
            return res.status(400).json(errorMessage(`${missingKeys.join(', ')} is Required`));
        }

        const query = `
            DELETE FROM RatingMaster WHERE ReviewUkeyId = '${ReviewUkeyId}'
        `
    
        const result = await pool.request().query(query);
            
        if(result.rowsAffected[0] === 0){
            return res.status(400).json({...errorMessage('No Orginizer Deleted.')})
        }

        return res.status(200).json({...successMessage('Orginizer Deleted Successfully.'), ReviewUkeyId});
    }catch(error){
        console.log('Delete Event Error :', error);
        return res.status(500).json({...errorMessage(error.message)});
    }
}

module.exports = {
    fetchRatings,
    RatingMaster,
    RemoveRating,
    countOfRatingAndsubscriber
}
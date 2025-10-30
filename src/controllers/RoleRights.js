const { pool } = require("../sql/connectToDatabase");
const { checkKeysAndRequireValues, errorMessage, getCommonKeys, successMessage, setSQLStringValue, setSQLNumberValue, getCommonAPIResponse } = require("../common/main");

const fetchRoleRights = async (req, res) => {
    try {
        const { UserUkeyId } = req.query;

        const missingKeys = checkKeysAndRequireValues(['UserUkeyId'], req.query);
        if(missingKeys.length > 0){
            return res.status(400).send(errorMessage(`${missingKeys} is required`));
        }

        const result = await pool.request().query(`
            SELECT 
                MM.MainMenuId, 
                MM.MenuName, 
                MM.IsActive AS IsActiveMenu, 
                RR.SubMenuId, 
                SM.SubMenuName AS SubMenuName, 
                SM.AliasName AS SubMenuAliasName,
                SM.IsActive AS IsActiveSubMenu, 
                COALESCE(RR.UserUkeyId, '') AS UserUkeyId  -- Replace NULL with empty string
            FROM Rolerights RR  
            LEFT JOIN SubMenu SM ON SM.SubMenuId = RR.SubMenuId
            LEFT JOIN MainMenu MM ON MM.MainMenuId = SM.MainMenuId
            WHERE RR.UserUkeyId = ${setSQLStringValue(UserUkeyId)}

            UNION ALL

            SELECT 
                MM.MainMenuId, 
                MM.MenuName, 
                MM.IsActive AS IsActiveMenu, 
                SM.SubMenuId, 
                SM.SubMenuName AS SubMenuName, 
                SM.AliasName AS SubMenuAliasName,
                SM.IsActive AS IsActiveSubMenu, 
                COALESCE(NULL, '') AS UserUkeyId  -- Replace NULL with empty string ('') or use 0 if needed
                FROM SubMenu SM 
            LEFT JOIN MainMenu MM ON MM.MainMenuId = SM.MainMenuId
            WHERE SM.SubMenuId NOT IN (
                SELECT SubMenuId FROM Rolerights RR WHERE RR.UserUkeyId = ${setSQLStringValue(UserUkeyId)}
            )
        `)

        const UserData = await pool.request().query(`
                select * from OrgUserMaster where UserUkeyId = ${setSQLStringValue(UserUkeyId)}
        `)

        if(UserData?.recordset?.[0]?.Role == 'Admin' || UserData?.recordset?.[0]?.Role == 'SuperAdmin'){
            for (const obj of result.recordset) {
                obj.UserUkeyId = UserUkeyId
            }
        } 

        return res.json({data : result.recordset});
    } catch (error) {
        console.log('fetch Asign Permission Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
};

const fetchMainMenu = async (req, res) => {
    try{
        const getUserList = {
            getQuery: `select * from MainMenu ORDER BY MainMenuId ASC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM MainMenu`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);
    }catch(error){
        console.log('fetch Main Menu Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const fetcSubMenu = async (req, res) => {
    try{
        const getUserList = {
            getQuery: `select * from SubMenu ORDER BY SubMenuId DESC`,
            countQuery: `SELECT COUNT(*) AS totalCount FROM SubMenu`,
        };
        const result = await getCommonAPIResponse(req, res, getUserList);
        return res.json(result);
    }catch(error){
        console.log('fetch Main Menu Error :', error);
        return res.status(500).send(errorMessage(error?.message));
    }
}

const addRoleRighys = async (req, res) => {
    try{
        const {UserUkeyId, SubMenuId, EventUkeyId} = req.body;
        const missingKeys = checkKeysAndRequireValues(['UserUkeyId'], req.body);
        if(missingKeys.length > 0){
            return res.status(400).send(errorMessage(`${missingKeys} is required`));
        }

        await pool.request().query(`DELETE FROM Rolerights WHERE UserUkeyId = ${setSQLStringValue(UserUkeyId)}`);

        const { IPAddress, ServerName, EntryTime } = getCommonKeys(req);
        const subMenuds = SubMenuId.split(',');
        let status = 0
        for(let id of subMenuds){
            if (id.trim() !== '') {
                const result = await pool.request().query(`INSERT INTO Rolerights (UserUkeyId, SubMenuId, IpAddress, HostName, EntryDate, EventUkeyId) VALUES (${setSQLStringValue(UserUkeyId)}, ${setSQLNumberValue(id)}, ${setSQLStringValue(IPAddress)}, ${setSQLStringValue(ServerName)}, ${setSQLStringValue(EntryTime)}, ${setSQLStringValue(EventUkeyId)})`);
                if (result.rowsAffected[0] > 0) {
                    status++;
                }
            }
        }

        // if(status === 0){
        //     return res.status(400).send(errorMessage('No Role Assigned'));
        // }
        return res.status(200).send({...successMessage('Role Assigned Successfully'), addedRows : status});
    }catch(error){
        console.log('add Asign Permission Error :', error);
        return res.status(500).send(errorMessage(error?.message))
    }
}

module.exports = {
    addRoleRighys,
    fetchRoleRights,
    fetchMainMenu,
    fetcSubMenu
}
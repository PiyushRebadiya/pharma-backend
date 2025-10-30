const moment = require('moment');
const {pool} = require('../sql/connectToDatabase');
const { getCommonKeys, setSQLBooleanValue, generateUUID } = require('../common/main');
const { autoVerifyBellNotification } = require('./autoRunQuery');

const sendNotificationOnSetTime = async () => {
    console.log("send notification on specific time", new Date());
    try {
        const Notifications = await pool.query(`
            EXEC auto_notification
        `);
        console.log('Notifications :>> ', Notifications);
        const users = await pool.query(`
            SELECT NotificationToken, Mobile1, FirstName FROM UserMaster WHERE NotificationToken IS NOT NULL
        `);
        // Iterate through notifications
        for (const notification of Notifications.recordset) {
            await sendNotificaton(notification, users.recordset);
            if(notification?.BellNotification){
                await addInnerNotification(notification);
            }
            await pool.query(`
                UPDATE AutoSentNotification 
                SET Status = 0 
                WHERE SentNotificationUkeyId = '${notification.SentNotificationUkeyId}'
                `);
        }
    } catch (error) {
        console.log('send notification on specific time error:', error);
    }
}

const sendNotificaton = async (notification, users) => {
    for (const user of users) {
        if (user.NotificationToken) {
            console.log('notification.Image :>> ', notification.Image);
            await sentNotificationOnSetTime({
                body: {
                    Title: notification?.Title || 'Notification',
                    Description: notification?.Description,
                    NotificationToken: user.NotificationToken,
                    Image: notification.Image,
                    BussinessName: user.FirstName,
                    MobileNumber: user.Mobile1,
                    Link: notification.Link
                }
            });
        }
    }
}

const addInnerNotification = async (notification) => {
    const { EntryTime, IPAddress, ServerName } = getCommonKeys();

    // Format the date using moment.js
    const formattedDate = moment(notification.SentTime).format('YYYY-MM-DD');

    const insertQuery = `INSERT INTO BellNotification (Image, Title, Description, Link, LinkType, StartDate, EndDate, Status, flag, IpAddress, HostName, EntryDate) VALUES (
        '${notification.Image}',
        N'${notification?.Title || 'Latest Notification'}',
        N'${notification.Description}',
        '${notification.Link}',
        '${notification.LinkType}',
        '${formattedDate}',
        '${formattedDate}',
        1,
        'A',
        '${IPAddress}',
        '${ServerName}',
        '${EntryTime}')`;

    await pool.query(insertQuery);
    await autoVerifyBellNotification();
};
module.exports = {
    sendNotificationOnSetTime
}
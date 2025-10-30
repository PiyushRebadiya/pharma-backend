const { pool } = require("../sql/connectToDatabase");

async function autoVerifyCarousel() {
    try {
        await pool.request().query(
            ` UPDATE Carousel
SET CarouselStatus = 
    CASE
        WHEN CAST(EndEventDate AS DATE) < CAST(GETDATE() AS DATE) THEN 'Expired'
        WHEN CAST(StartEventDate AS DATE) > CAST(GETDATE() AS DATE) THEN 'Pending'
        ELSE 'Active'
    END WHERE AlwaysShow = 0`,
        );

        await pool.request().query(
            `UPDATE Carousel SET CarouselStatus = 'Active' WHERE AlwaysShow = 1`,
        )
        console.log("Carousel statuses updated successfully");
    } catch (error) {
        console.log("Auto Verify Carousel", error);
    }
}

async function autoVerifyBellNotification() {
    try {
        await pool.request().query(
            ` UPDATE BellNotification
SET NotificationStatus = 
    CASE
        WHEN CAST(EndDate AS DATE) < CAST(GETDATE() AS DATE) THEN 'Expired'
        WHEN CAST(StartDate AS DATE) > CAST(GETDATE() AS DATE) THEN 'Pending'
        ELSE 'Active'
    END`,
        );
        console.log("Notification statuses updated successfully");
    } catch (error) {
        console.log("Auto Verify Notification", error);
    }
}

async function autoUpdateEvent (){
    try{
        await pool.request().query(
            ` UPDATE EventMaster
            SET IsActive = 0
            WHERE EndEventDate < GETDATE()
            AND IsActive = 1;
            `,
        );        
    }catch(error){
        console.log("Auto update coupon : ", error);
    }
}

async function autoUpdateCoupon (){
    try{
        await pool.request().query(
            ` UPDATE CouponMaster
            SET IsActive = 0
            WHERE EndDate < GETDATE()
            AND IsActive = 1;
            `,
        );        
    }catch(error){
        console.log("Auto update coupon : ", error);
    }
}

const CleanUpLocksSeats = async () => {
    try {
        const query = `EXEC [dbo].[sp_CleanupOldLocks]`;
        await pool.query(query);
    } catch (error) {
        console.error('Error in auto tasks:', error);
    }
};

module.exports = { autoVerifyCarousel, autoVerifyBellNotification, autoUpdateEvent, autoUpdateCoupon, CleanUpLocksSeats };
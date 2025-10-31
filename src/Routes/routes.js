const router = require("express").Router();
const UserMasterController = require('../controllers/User_Master');
const AdminController = require('../controllers/tbl_admin');
const UserController = require('../controllers/tbl_users');
const auth = require("../middleware/auth");

const { UserUpload } = require('../upload/index');

//#region User Master
router.get("/fetchUserMaster", auth, UserMasterController.fetchUserMaster)
//#endregion

//#region admin master
router.get("/admin/list", AdminController.fetchAdmin)
router.post("/admin/create", AdminController.createAdmin)
router.put("/admin/update", AdminController.updateAdmin)
router.delete("/admin/delete", AdminController.deleteAdmin)
//#endregion

//#region user master
router.get("/user/list", UserController.fetchUsers)
router.post("/user/create", UserController.createUser)
router.put("/user/update", UserController.updateUser)
router.delete("/user/delete", UserController.deleteUser)
router.get("/user/byid/:UserId", UserController.getUserById)
router.get("/user/check_email_availability", UserController.checkEmailAvailability)
router.get("/user/check_username_availability", UserController.checkUsernameAvailability)
//#endregion

module.exports = router;
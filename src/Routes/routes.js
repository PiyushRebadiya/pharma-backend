const router = require("express").Router();
const UserMasterController = require('../controllers/User_Master');
const AdminController = require('../controllers/tbl_admin');
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

module.exports = router;
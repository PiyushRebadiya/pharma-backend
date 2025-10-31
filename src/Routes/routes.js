const router = require("express").Router();
const UserMasterController = require('../controllers/User_Master');
const AdminController = require('../controllers/tbl_admin');
const UserController = require('../controllers/tbl_users');
const UserAddressController = require('../controllers/tbl_user_address');
const ProductCategoryController = require('../controllers/tbl_product_category');
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

//#region user address master
router.get("/user_address/list", UserAddressController.fetchUserAddress)
router.post("/user_address/create", UserAddressController.createUserAddress)
router.put("/user_address/update", UserAddressController.updateUserAddress)
router.delete("/user_address/delete", UserAddressController.deleteUserAddress)
router.get("/user_address/byid/:UserAddressId", UserAddressController.getUserAddressById)
//#endregion

//#region product category master
router.get("/product_category/list", ProductCategoryController.fetchProductCategory)
router.post("/product_category/create", ProductCategoryController.createProductCategory)
router.put("/product_category/update", ProductCategoryController.updateProductCategory)
router.delete("/product_category/delete", ProductCategoryController.deleteProductCategory)
//#endregion


module.exports = router;
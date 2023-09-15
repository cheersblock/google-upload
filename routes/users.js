var express = require("express");
const { uploadZip, uploadZipFile } = require("../controllers/upload");
const { uploadZipSync } = require("../controllers/uploadSync");
const { uploadBunnyZip, download } = require("../controllers/uploadBunny");
var router = express.Router();

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

router.route("/upload").post(uploadZipFile, uploadZip);
router.route("/upload-sync").post(uploadZipFile, uploadZipSync);
router.route("/upload-bunny").post(uploadZipFile, uploadBunnyZip);
router.route("/download").get(download);

module.exports = router;

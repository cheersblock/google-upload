import nc from "next-connect";
import onError from "../../../common/errormiddleware";
import multer from "multer";
import path from "path";
import { executeQuery } from "../../../config/db";
import AdmZip from "adm-zip";
import fs from "fs";

const folderId = "1dW72byCbJGEJNi12TL9RxGwrk0b4ViYw";

export const config = {
  api: {
    bodyParser: false,
  },
};

const handler = nc(onError);

const { google } = require("googleapis");
const getDriveService = () => {
  const KEYFILEPATH = path.join(__dirname, "key.json");
  const SCOPES = ["https://www.googleapis.com/auth/drive"];

  const auth = new google.auth.GoogleAuth({
    keyFile: "./pages/api/key.json",
    scopes: SCOPES,
  });
  const driveService = google.drive({ version: "v3", auth });
  return driveService;
};

const drive = getDriveService();

let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

let upload = multer({
  storage: storage,
});

let uploadFile = upload.single("zipFile");
handler.use(uploadFile);

handler.post(async (req, res) => {
  console.log("req.file", req.file);
  console.log("req.body", req.body);

  console.log("req.file.filename", req.file.filename);

  // Unzip File
  const uploadedFilePath = path.join("./public", req.file.filename);
  const unzipDestination = path.join(
    "./unzipped",
    req.file.filename.replace(".zip", "")
  );
  let filename = req.file.filename.replace(".zip", "");

  const zip = new AdmZip(uploadedFilePath);
  zip.extractAllTo(unzipDestination, true);

  // Upload to Google
  // Create Folder
  const fileMetadata = {
    name: filename,
    parents: [folderId],
    mimeType: "application/vnd.google-apps.folder",
  };
  var fileId;
  const file = await drive.files
    .create({
      resource: fileMetadata,
      fields: "id",
    })
    .then((res) => {
      console.log("🚀 ~ file: index.js:81 ~ .then ~ res:", res.data.id);
      fileId = res.data.id;
      scanFolderForFiles(unzipDestination, res.data.id).then(
        async () => await fs.promises.rmdir(unzipDestination)
      );
    });
  console.log("Folder Id:", file.data.id);

  res.status(200).send({
    //result: result,
    // folderId: fileId,
    message: "Success",
  });
});

const uploadSingleFile = async (fileName, filePath, _folderId) => {
  console.log("Folder Id inside upload file:", _folderId);

  const { data: { id, name } = {} } = await drive.files.create({
    resource: {
      name: fileName,
      parents: [_folderId],
    },
    media: {
      mimeType: "application/zip",
      body: fs.createReadStream(filePath),
    },
    fields: "id,name",
  });
  console.log("File Uploaded", name, id);
};

const scanFolderForFiles = async (folderPath, _fId) => {
  const folder = await fs.promises.opendir(folderPath);
  for await (const dirent of folder) {
    if (dirent.isFile()) {
      await uploadSingleFile(
        dirent.name,
        path.join(folderPath, dirent.name),
        _fId
      ).then(
        async () => await fs.promises.rm(path.join(folderPath, dirent.name))
      );
    }
  }
};

export default handler;

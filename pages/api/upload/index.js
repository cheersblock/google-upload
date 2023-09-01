import nc from "next-connect";
import onError from "../../../common/errormiddleware";
import multer from "multer";
import path from "path";
import AdmZip from "adm-zip";
import fs from "fs";
import { Server } from "socket.io";
import http from "http";
import { toAll } from "../socket";
const { google } = require("googleapis");

var numberOfFiles = 0;
var filesDoneUpl = 0;
var mainDirectory = "";

const handler = nc(onError);

const folderId = "1dW72byCbJGEJNi12TL9RxGwrk0b4ViYw";

export const config = {
  api: {
    bodyParser: false,
  },
};

const getDriveService = () => {
  const KEYFILEPATH = path.join(__dirname, "key.json");
  const SCOPES = ["https://www.googleapis.com/auth/drive"];

  // google.options({
  //   timeout: 5000,
  //   retryConfig: {
  //     retry: 100,
  //     retryDelay: 1000,
  //   },
  //   retry: true,
  // });

  const auth = new google.auth.GoogleAuth({
    keyFile: "./pages/api/key.json",
    scopes: SCOPES,
  });
  const driveService = google.drive({ version: "v3", auth });
  return driveService;
};

const drive = getDriveService();

const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

let uploadFile = upload.single("zipFile");
handler.use(uploadFile);

handler.post(async (req, res) => {
  console.log("req.file", req.file);
  console.log("req.body", req.body);
  const socketio = res.socket.server.io;

  console.log("req.file.filename", req.file.originalname);

  // Unzip File
  const unzipDestination = path.join(
    "./unzipped",
    req.file.originalname.replace(".zip", "")
  );
  let filename = req.file.originalname.replace(".zip", "");

  const zip = new AdmZip(req.file.buffer);
  zip.extractAllTo(unzipDestination, true);
  const entries = zip.getEntries();
  mainDirectory = unzipDestination;
  // numberOfFiles = entries.length;
  // filesDoneUpl = entries.length;
  // console.log("Entries of files", numberOfFiles);

  entries.forEach((entry) => {
    if (!entry.isDirectory) {
      ++numberOfFiles;
      ++filesDoneUpl;
    }
  });

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
      scanFolderForFiles(unzipDestination, res.data.id, socketio).then(
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

const uploadSingleFile = async (fileName, filePath, _folderId, res) => {
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
  const progress = 1;
  // io.emit("progress", { id, progress });
  // toAll("progress", id, progress);
  --filesDoneUpl;
  res.sockets.emit("progress", { numberOfFiles, filesDoneUpl });
};

const scanFolderForFiles = async (folderPath, _fId, socketio) => {
  const folder = await fs.promises.opendir(folderPath);
  for await (const dirent of folder) {
    if (dirent.isFile()) {
      await uploadSingleFile(
        dirent.name,
        path.join(folderPath, dirent.name),
        _fId,
        socketio
      ).then(
        async () => await fs.promises.rm(path.join(folderPath, dirent.name))
      );
    } else if (dirent.isDirectory()) {
      var newFilePath = path.join(folderPath, dirent.name);
      console.log("Directory Path", newFilePath);
      const fileMetadata = {
        name: dirent.name,
        parents: [_fId],
        mimeType: "application/vnd.google-apps.folder",
      };
      const file = await drive.files
        .create({
          resource: fileMetadata,
          fields: "id",
        })
        .then((res) => {
          scanFolderForFiles(newFilePath, res.data.id, socketio).then(
            async () => {
              await fs.promises.rmdir(newFilePath);
              if (filesDoneUpl == 0) {
                fs.rmSync(mainDirectory, { recursive: true, force: true });
                console.log("--------Done Uploading!---------");
              }
            }
          );
        });
    }
  }
};

export default handler;

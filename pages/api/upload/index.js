import nc from "next-connect";
import onError from "../../../common/errormiddleware";
import multer from "multer";
import path from "path";
import { executeQuery } from "../../../config/db";
import AdmZip from "adm-zip";
import fs from "fs";
import { Server } from "socket.io";
import http from "http";
import { toAll } from "../socket";
// import ioHandler from "./../socket";

// console.log("IOIOIOI", ioHandler.io);

const handler = nc(onError);

// Create an HTTP server for WebSocket
// const httpServer = http.createServer(handler);
// const io = new Server(httpServer);

// io.on("connection", (socket) => {
//   console.log("A user connected");

//   // Handle progress updates
//   socket.on("progress", (data) => {
//     console.log("Progress update received:", data);
//     // Emit progress update to all connected clients
//     io.emit("progress", data);
//   });
// });

const folderId = "1dW72byCbJGEJNi12TL9RxGwrk0b4ViYw";

export const config = {
  api: {
    bodyParser: false,
  },
};

// const handler = nc(onError);

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

// let storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "public");
//   },
//   filename: function (req, file, cb) {
//     cb(null, file.originalname);
//   },
// });

// let upload = multer({
//   storage: storage,
// });

const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

let uploadFile = upload.single("zipFile");
handler.use(uploadFile);

handler.post(async (req, res) => {
  console.log("req.file", req.file);
  console.log("req.body", req.body);
  // console.log("res.socket.server.io", res.socket.server.io);
  // io = res.socket.server.io;
  // socket.emit("hello", "worldsss!");

  console.log("req.file.filename", req.file.originalname);

  // Unzip File
  // const uploadedFilePath = path.join("./public", req.file.originalname);
  const unzipDestination = path.join(
    "./unzipped",
    req.file.originalname.replace(".zip", "")
  );
  let filename = req.file.originalname.replace(".zip", "");

  const zip = new AdmZip(req.file.buffer);
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
      scanFolderForFiles(unzipDestination, res.data.id, res).then(
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
  toAll("progress", id, progress);
  // res.socket.server.io.emit("progress", { id, progress });
};

const scanFolderForFiles = async (folderPath, _fId, res) => {
  const folder = await fs.promises.opendir(folderPath);
  for await (const dirent of folder) {
    if (dirent.isFile()) {
      await uploadSingleFile(
        dirent.name,
        path.join(folderPath, dirent.name),
        _fId,
        res
      ).then(
        async () => await fs.promises.rm(path.join(folderPath, dirent.name))
      );
    } else if (dirent.isDirectory()) {
      var newFilePath = path.join(folderPath, "/", dirent.name);
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
          scanFolderForFiles(newFilePath, res.data.id).then(
            async () => await fs.promises.rmdir(newFilePath)
          );
        });
    }
  }
};

export default handler;

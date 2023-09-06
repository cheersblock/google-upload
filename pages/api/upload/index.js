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
var totalSize = 0;

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

  google.options({
    timeout: 5000,
    retryConfig: {
      retry: 100,
      retryDelay: 1000,
    },
    retry: true,
  });

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
  console.log("Size:", req.file.size);
  console.log("req.body", req.body);
  const socketio = res.socket.server.io;
  totalSize = req.file.size;

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
    .then(async (res) => {
      console.log("🚀 ~ file: index.js:81 ~ .then ~ res:", res.data.id);

      fileId = res.data.id;
      await scanFolderForFiles(unzipDestination, res.data.id, socketio);
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
  try {
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
    --filesDoneUpl;
    res.sockets.emit("progress", { numberOfFiles, filesDoneUpl });
    console.log("4");
  } catch (e) {
    // console.log("Error on catch", e);
  }
};

const scanFolderForFiles = async (folderPath, _fId, socketio) => {
  console.log("insde scan -----");
  console.log("insde scan ---folderPath--", folderPath);
  const folder = fs.opendirSync(folderPath);
  for await (const dirent of folder) {
    console.log("dir-----", dirent);
    if (dirent.isFile()) {
      console.log("3");
      let p = path.join(folderPath, dirent.name);
      console.log("path ---------", p);
      await uploadSingleFile(
        dirent.name,
        path.join(folderPath, dirent.name),
        _fId,
        socketio
      )
        .then(
          async () => await fs.promises.rm(path.join(folderPath, dirent.name))
        )
        .then(
          // logic to remove the folder
          async () => {
            const folderContents = await fs.readdirSync(folderPath);
            console.log(
              "folderContents-----length-------",
              folderContents.length
            );
            console.log("folderContents------------", folderContents);
            if (folderContents.length === 0) {
              console.log(
                "🚀 ~ file: index.js:163 ~ folderContents:",
                folderContents
              );
              //   await fs.promises.rmdir(folderPath);
              console.log("Folder about to be removed-----", folderPath);
              await fs.promises.rm(folderPath, {
                recursive: true,
                force: true,
              });
            }
          }
        );
      console.log("5");
    }
    if (dirent.isDirectory()) {
      try {
        console.log("6");
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
          .then(async (res) => {
            console.log("7");
            await scanFolderForFiles(newFilePath, res.data.id, socketio)
              .then(
                // logic to remove the folder
                async () => {
                  const folderContents = fs.readdirSync(newFilePath);
                  console.log(
                    "folderContents2-----length-------",
                    folderContents.length
                  );
                  console.log("folderContents2------------", folderContents);
                  if (folderContents.length === 0) {
                    // await fs.promises.rmdir(folderPath);
                    console.log("Folder about to be removed-----", newFilePath);
                    await fs.promises.rm(newFilePath, {
                      recursive: true,
                      force: true,
                    });
                  }
                }
              )
              .then(
                console.log(
                  "🚀 ~ file: index.js:176 ~ .then ~ newFilePath:",
                  newFilePath
                ),
                async () => {
                  // await fs.promises
                  //   .rmdir(newFilePath)
                  //   .then(console.log("Folder deleted"))
                  //   .catch((err) => {
                  //     console.log("Error here", err);
                  //   });
                  if (filesDoneUpl == 0) {
                    console.log("filesDoneUPL-------------", filesDoneUpl);
                    fs.rmSync(mainDirectory, { recursive: true, force: true });
                    socketio.emit("Done Uploading", {
                      numberOfFiles,
                      totalSize,
                    });
                    console.log("--------Done Uploading!---------");
                  }
                  console.log("8");
                }
              );
            console.log("9");
          });
      } catch (error) {
        console.log("🚀 ~ file: index.js:188 ~ forawait ~ error:", error);
      }
    }
  }
};

export default handler;

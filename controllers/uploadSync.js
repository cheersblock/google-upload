const multer = require("multer");
const path = require("path");
const AdmZip = require("adm-zip");
const fs = require("fs");
const { google } = require("googleapis");
const key = require("./../key.json");
const catchAsync = require("../utils/catchAsync");
const { to } = require("await-to-js");

var numberOfFiles = 0;
var filesDoneUpl = 0;
var mainDirectory = "";
var totalSize = 0;

const folderId = "1dW72byCbJGEJNi12TL9RxGwrk0b4ViYw";

const getDriveService = () => {
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
    keyFile: "./key.json",
    scopes: SCOPES,
  });
  const driveService = google.drive({ version: "v3", auth });
  return driveService;
};

const drive = getDriveService();

const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

exports.uploadZipFile = upload.single("zipFile");

exports.uploadZipSync = catchAsync(async (req, res, next) => {
  try {
    console.log("req.file", req.file);
    console.log("Size:", req.file.size);
    console.log("req.body", req.body);
    const socketio = "res.socket.server.io";

    totalSize = req.file.size;

    console.log("req.file.filename", req.file.originalname);

    const unzipDestination = path.join(
      "./unzipped",
      req.file.originalname.replace(".zip", "")
    );
    let filename = req.file.originalname.replace(".zip", "");

    const zip = new AdmZip(req.file.buffer);
    zip.extractAllTo(unzipDestination, true);
    const entries = zip.getEntries();
    mainDirectory = unzipDestination;

    for (const entry of entries) {
      if (!entry.isDirectory) {
        ++numberOfFiles;
        ++filesDoneUpl;
        const [err] = await to(
          uploadSingleFile(
            entry.name,
            path.join(unzipDestination, entry.name),
            folderId,
            socketio
          )
        );
        if (err) {
          throw new Error(`Error uploading file: ${err.message}`);
        }
        await fs.promises.rm(path.join(unzipDestination, entry.name));
      }
    }

    const [createFolderError, file] = await to(
      drive.files.create({
        resource: {
          name: filename,
          parents: [folderId],
          mimeType: "application/vnd.google-apps.folder",
        },
        fields: "id",
      })
    );

    if (createFolderError) {
      throw new Error(`Error creating folder: ${createFolderError.message}`);
    }

    console.log("Folder Id:", file.data.id);

    res.status(200).send({
      message: "Success",
    });
  } catch (e) {
    console.log("ERROR:", e);
  }
});

const uploadSingleFile = async (fileName, filePath, _folderId, socketio) => {
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
    console.log(
      `⚡️⚡️⚡️⚡️⚡️⚡️⚡️ Progress ⚡️ Total:${numberOfFiles}  Uploaded:${filesDoneUpl}`
    );
    return null;
  } catch (e) {
    console.log("Error on catch", e);
    return e;
  }
};

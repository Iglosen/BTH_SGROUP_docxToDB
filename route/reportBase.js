/**
 * Route for reportBase.
 */

"use strict";

const express           = require("express");
const router            = express.Router();
const reportDB          = require("../src/reportBase.js");
const bodyParser        = require("body-parser");
const upload            = require("express-fileupload");
const mammoth           = require("mammoth");
const htmlToJson        = require("html-to-json");
const fs                = require('fs');
const opn               = require('opn');
const path              = require('path');

const app = express();

router.use(upload());
opn('http://localhost:1337/wordToDB'); //Opens server in default broswer

router.get("/wordToDB", (req, res, next) => {
    let data = {
        title: 'Word-tables to database',
    };
    res.render("wordToDB", data);
});

router.get("/mammoth", async (req, res) => {
    let data = {
        title: 'Upload in progress'
    };
    //Get all files in uploaded_files
    var docxFiles = fs.readdirSync("./uploaded_files", {withFileTypes: ".docx"});
    //Filter out everything that's not a .docx file
    docxFiles = docxFiles.filter(docxFiles => (docxFiles.indexOf(".docx") != -1));

    console.log(docxFiles);

    let wait = await reportDB.addGeo();

    for (var i = 0; i < docxFiles.length; i++) {
        (function() {
        var id = docxFiles[i].replace(".docx", "");
        id = id.replace(/" "/g, "");
        var path = "./uploaded_files/" + docxFiles[i];
        console.log(path);

    //Converts docx to html, then to JSON, then to Database
    mammoth.convertToHtml({path: path})
        .then(async function(result){
            var html = result.value; // The generated HTML
            var messages = result.messages; // Any messages, such as warnings during conversion

            //Create JSON-object out of "var html"
            var promise = htmlToJson.batch(html, {
                //JSON Header objects
                headers: htmlToJson.createParser(['p strong', {
                  'tableName': function ($section) {

                      var headerString = $section.text(); //reads everything with bold text as headers
                      switch (headerString) {
                        //Ignore these lines
                        case "Databaser" || "databaser":
                        case "Beskrivning" || "beskrivning":
                        case "Fastighetsdatavyer" || "fastighetsdatavyer":
                        case "Backup" || "backup":
                            return null;
                            break;

                        default:
                            return headerString;
                            break;
                     }

                  },
                   }]),
                   //JSON Table-content
                  tables: htmlToJson.createParser(['table', {
                    'table': function ($column) {
                        return this.map('tr', function ($column) {
                                return this.map('td', function ($column) {
                                    return this.map('p', function ($column) {
                                        var text = $column.text();
                                        //console.log(text);
                                        return text;
                                    });
                                });
                        });
                    }
                }]),
            });
            //Finished JSON object lands in items
              promise.done(async function (items) {
                  //Remove empty headers from the JSON object
                  for (var i = 0; i < items.headers.length; i++) {
                      if (items.headers[i].tableName === null) {
                          items.headers.splice(i, 1);
                          i--;
                      }
                  }
                  /*
                //Write to console commands
                console.log(items.headers);
                //console.log(JSON.stringify(items.tables, null, 4));

                for (var i = 0; i < items.headers.length; i++) {
                    console.log(items.headers[i]);
                    console.log(JSON.stringify(items.tables[i], null, 4));
                }

                console.log(id);
                */
                id = id.replace(/ /g, "");
                if (id.indexOf("_") == -1) {
                    id += "_drift";
                }
                let wait = await reportDB.addToDatabase(items, id);

              }, function (err) {
                // Handle error
            });
            //console.log(messages);
            //console.log(html);
        })
        .done();
        fs.unlink(path, (err) => {
            if (err) throw err;
            console.log(path + " was deleted");
        });
        })();
    }
    res.render("uploadDone", data);
});

router.post("/mammoth", (req, res, next) => {
    res.redirect("/wordToDB");
});

//Laddar upp filen som läggs in i wordToDB(GET) till uploaded_files
//O.B.S Skriver över filer med samma namn, borde inte vara ett problem dock
router.post("/wordToDB", (req, res, next) => {
    //console.log(req.files);
    if (req.files) {
        var files = req.files.fileUpload;
        var responseString = "test";
        console.log("Sent " + files.length + " files to /uploaded_files/");
        for (var i = 0; i < files.length; i++) {
            var file = req.files.fileUpload[i];
                //console.log(file);
                var uploadpath = "./uploaded_files/" + file.name;
                file.mv(uploadpath, function(err) {
                    if (err) {
                        console.log(err);
                        responseString += ("Error occured on file" + file.name +"\n");
                    }
                    else {
                        //extracter.fs.stat(uploadpath);
                        responseString += ("File (" + file.name + ") uploaded\n");
                    }
                })
                        responseString += " test";
        }

        res.redirect("/mammoth");
    }
    else {
        res.send("Invalid files");
    }
});

module.exports = router;

(function () {
   "use strict";
   const port    = process.env.DBWEBB_PORT || 1337;
   const path    = require("path");
   const express = require("express");
   const app = express();
   const middleware = require("./middleware/index.js");
   const bodyParser = require("body-parser");
   const urlencodedParser = bodyParser.urlencoded({ extended: false });
   const upload            = require("express-fileupload");
   const mammoth           = require("mammoth");
   const htmlToJson        = require("html-to-json");
   const fs                = require('fs');
   const reportBase = require(path.join(__dirname, "./src/reportBase.js"));

   app.set('views', path.join(__dirname, './views'));
   app.engine('html', require('ejs').renderFile);
   app.set('view engine', 'ejs');

   app.use(middleware.logIncomingToConsole);
   app.use(express.static(path.join(__dirname, "./public")));
   app.listen(port, logStartUpDetailsToConsole);



   app.use(upload());


   app.get("/", (req, res) => {
       let data = {
           title: "Index"
       };

       res.render("index", data);
   });

   app.get("/wordToDB", (req, res, next) => {
       let data = {
           title: 'Word-tables to database',
       };
       res.render("wordToDB", data);
   });

   app.get("/mammoth", async (req, res) => {
       //Get all files in uploaded_files
       var docxFiles = fs.readdirSync("./uploaded_files", {withFileTypes: ".docx"});
       //Filter out everything that's not a .docx file
       docxFiles = docxFiles.filter(docxFiles => (docxFiles.indexOf(".docx") != -1));

       console.log(docxFiles);

       for (var i = 0; i < docxFiles.length; i++) {
           (function() {
           var id = docxFiles[i].replace(".docx", "");
           id = id.replace(" ", "");
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
                           case "Databaser":
                           case "Beskrivning":
                           case "Fastighetsdatavyer":
                           case "Backup":
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
                   //Write to console commands
                   console.log(items.headers);
                   //console.log(JSON.stringify(items.tables, null, 4));

                   for (var i = 0; i < items.headers.length; i++) {
                       console.log(items.headers[i]);
                       console.log(JSON.stringify(items.tables[i], null, 4));
                   }

                   console.log(id);
                   let wait = await reportDB.addToDatabase(items, id);


                 }, function (err) {
                   // Handle error
               });
               //console.log(messages);
               //console.log(html);
           })
           .done();
       })();
       }
       let data = {
           title: 'Upload complete'
       };
       res.render("complete", data);
   });

   //Uploads the files from wordToDB to uploaded_files
   app.post("/wordToDB", (req, res, next) => {
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

   module.exports = app;
   /**
    * Log incoming requests to console to see who accesses the server
    * on what route.
    *
    * @param {Request}  req  The incoming request.
    * @param {Response} res  The outgoing response.
    * @param {Function} next Next to call in chain of middleware.
    *
    * @returns {void}
    */



   function logIncomingToConsole(req, res, next) {
       console.info(`Got request on ${req.path} (${req.method}).`);
       next();
   }


   module.exports = {
       logIncomingToConsole: logIncomingToConsole
   };

   /**
    * Log app details to console when starting up.
    *
    * @return {void}
    */
   function logStartUpDetailsToConsole() {
       let routes = [];

       // Find what routes are supported
       app._router.stack.forEach((middleware) => {
           if (middleware.route) {
               // Routes registered directly on the app
               routes.push(middleware.route);
           } else if (middleware.name === "router") {
               // Routes added as router middleware
               middleware.handle.stack.forEach((handler) => {
                   let route;

                   route = handler.route;
                   route && routes.push(route);
               });
           }
       });

       console.info(`Server is listening on port ${port}.`);
       console.info("Available routes are:");
       console.info(routes);
   }

}());

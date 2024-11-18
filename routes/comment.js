const express = require("express");

const auth = require("../middleware/auth");

const routes = express.Router();
const postController = require("../controller/post");

routes.post("/addComment", auth, postController.addComment);
routes.get("/getComment/:postId",auth, postController.getComment);


module.exports = routes;

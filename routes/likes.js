const express = require("express");

const auth = require("../middleware/auth");

const routes = express.Router();
const postController = require("../controller/post");

routes.put("/like", auth, postController.likePost);
routes.put("/unlike",auth, postController.unlikePost);


module.exports = routes;

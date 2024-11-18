const User = require("../model/User");
const Post = require("../model/Post");
const PostCategory = require("../model/PostCategory");
const { Readable } = require("nodemailer/lib/xoauth2");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

// cloudinary.config({
//   cloud_name: "dqonckbjd",
//   api_key: process.env.CLOUDINARY_API,
//   api_secret: process.env.CLOUDINARY_SECRET,
// });

exports.addPost = (req, res, next) => {
  const { title, category, content, desc, imageSource, status, tag, image } = req.body;

  const imageName = "temp";

  if (!title || !category || !content || !desc || !image || !status || !tag) {
    const error = new Error("All fields are required");
    error.statusCode = 400;
    return next(error);
  }

  const post = new Post({
    title,
    content,
    desc,
    category,
    image,
    imgSource: imageSource,
    tag,
    status,
    user: req.userId,
    imageName
  });

  let postId;

  post
    .save()
    .then((result) => {
      if (!result) {
        const error = new Error("Server error while saving post");
        error.statusCode = 500;
        throw error;
      }

      postId = result._id;
      return PostCategory.findById(category);
    })
    .then((categoryData) => {
      if (!categoryData) {
        const error = new Error("Category not found");
        error.statusCode = 404;
        throw error;
      }

      categoryData.posts.push(postId);
      return categoryData.save();
    })
    .then((result) => {
      if (!result) {
        const error = new Error("Server error while saving category");
        error.statusCode = 500;
        throw error;
      }

      return User.findById(req.userId);
    })
    .then((user) => {
      if (!user) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }

      user.posts.push(postId);
      return user.save();
    })
    .then((result) => {
      if (!result) {
        const error = new Error("Server error while saving user");
        error.statusCode = 500;
        throw error;
      }

      res.status(201).json({ message: "Post added successfully", postId });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};


exports.getProfilePost = (req, res, next) => {
  const pageNumber = req.query.page || 1;
  const getType = req.query.type || "allpost";
  const postStatus = req.query.postStatus || "publish";

  const perPageItem = 6;

  let totalItem;
  let totalPage;

  let type = postStatus === "draft" ? "draft" : "publish";

  let option = getType === "recyclebin" ? "Delete" : type;

  Post.find({
    user: req.userId,
    status: option,
  })
    .countDocuments()
    .then((count) => {
      totalItem = count;

      return Post.find({
        user: req.userId,
        status: option,
      })
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * perPageItem)
        .limit(perPageItem);
    })

    .then((post) => {
      if (post.length == 0) {
        const error = new Error("no post available");
        error.statusCode = 404;
        throw error;
      }

      totalPage = Math.ceil(totalItem / perPageItem);

      const postData = post.map((data) => {
        return {
          imageUrl: data.image,
          desc: data.title,
          postId: data._id,
        };
      });

      res.status(200).json({
        message: "post get done",
        postData: postData,
        totalItem: totalItem,
        totalPage: totalPage,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.getEditPostData = (req, res, next) => {
  const postId = req.body.postId;

  Post.findOne({ _id: postId, user: req.userId })
    .then((post) => {
      if (!post) {
        const error = new Error("no post available");
        error.statusCode = 401;
        throw error;
      }
      res.status(200).json({ message: "post get done", postData: post });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.postEditData = (req, res, next) => {
  const { title, category, content, desc, imageSource, status, tag, postId } =
    req.body;

  if (req.body.image) {
    Post.findById(postId)
      .then((post) => {
        if (!post) {
          const err = new Error("no post available");
          err.statusCode = 404;
          throw err;
        }

        post.title = title;
        post.category = category;
        post.content = content;
        post.desc = desc;
        post.imgSource = imageSource;
        post.status = status;
        post.tag = tag;
        post.updatedAt = Date.now();

        return post.save();
      })
      .then((result) => {
        res.status(200).json({ message: "post edit done", postData: result });
      })
      .catch((err) => {
        if (!err.statusCode) {
          err.statusCode = 500;
        }
        next(err);
      });
  } else {
    const imageBuffer = req.file.buffer;
    const imageName = req.file.originalname;
    const uniqueFileName =
      imageName + "-" + Date.now() + "-" + Math.round(Math.random() * 1e9);

    let imageUrl;
    const options = {
      unique_filename: false,
      overwrite: true,
      public_id: "Blog/image" + uniqueFileName,
    };

    const uploadImage = async (imageBuffer) => {
      try {
        const writeBufferFile = cloudinary.uploader.upload_stream(
          options,
          (error, result) => {
            if (error) {
              const err = new Error(error);
              err.statusCode = 403;
              throw err;
            }
            imageUrl = result.secure_url;

            Post.findById(postId)
              .then((post) => {
                if (!post) {
                  const err = new Error("no post available");
                  err.statusCode = 404;
                  throw err;
                }

                post.title = title;
                post.category = category;
                post.content = content;
                post.desc = desc;
                post.imgSource = imageSource;
                post.status = status;
                post.tag = tag;
                post.image = imageUrl;
                post.updatedAt = Date.now();
                post.imageName = imageName;

                return post.save();
              })
              .then((result) => {
                res
                  .status(200)
                  .json({ message: "post edit done", postData: result });
              })
              .catch((err) => {
                if (!err.statusCode) {
                  err.statusCode = 500;
                }
                next(err);
              });
          }
        );
        const readableStream = Readable.from(imageBuffer);
        readableStream.pipe(writeBufferFile);
      } catch (err) {
        if (!err.statusCode) {
          err.statusCode = 500;
          next(err);
        }
      }
    };

    uploadImage(imageBuffer);
  }
};

exports.deletePost = (req, res, next) => {
  const postId = req.body.postId;
  const postStatus = req.body.status;

  const perPage = 6;
  let totalPost;
  let totalPage;

  Post.findOne({ user: req.userId, _id: postId, status: postStatus })
    .then((post) => {
      if (!post) {
        const error = new Error("post not found");
        error.statusCode = 401;
        throw error;
      }

      post.status = "Delete";

      return post.save();
    })
    .then((result) => {
      if (!result) {
        const error = new Error("server error");
        error.statusCode = 401;
        throw error;
      }

      return Post.find({
        user: req.userId,
        status: postStatus,
      }).countDocuments();
    })
    .then((count) => {
      totalPost = count;

      return Post.find({
        user: req.userId,
        status: postStatus,
      })

        .sort({ createdAt: -1 })
        .limit(6);
    })
    .then((posts) => {
      if (!posts) {
        const error = new Error("server error");
        error.statusCode = 401;
        throw error;
      }

      totalPage = Math.ceil(totalPost / perPage);

      const postData = posts.map((data) => {
        return {
          imageUrl: data.image,
          desc: data.title,
          postId: data._id,
        };
      });

      res.status(200).json({
        message: "post get done",
        postData: postData,
        totalPage: totalPage,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.restorePost = (req, res, next) => {
  const postId = req.body.postId;

  let perPage = 6;
  let totalPost;
  let totalPage;

  Post.findOne({ user: req.userId, _id: postId })
    .then((post) => {
      if (!post) {
        const error = new Error("server error");
        error.statusCode = 401;
        throw error;
      }

      post.status = "draft";

      return post.save();
    })
    .then((result) => {
      return Post.find({ user: req.userId, status: "Delete" }).countDocuments();
    })
    .then((count) => {
      totalPost = count;
      return Post.find({ user: req.userId, status: "Delete" })
        .sort({ createdAt: -1 })
        .limit(perPage);
    })
    .then((posts) => {
      totalPage = Math.ceil(totalPost / perPage);

      if (!posts) {
        const error = new Error("server error");
        error.statusCode = 401;
        throw error;
      }
      const postData = posts.map((data) => {
        return {
          imageUrl: data.image,
          desc: data.title,
          postId: data._id,
        };
      });

      res.status(200).json({
        message: "post restore done",
        postData: postData,
        totalPage: totalPage,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.deletFromRecycleBin = (req, res, next) => {
  const postId = req.body.postId;
  let postData;
  let totalPost;
  let totalPage;
  const postPerPage = 6;

  Post.findOne({ user: req.userId, _id: postId })
    .then((post) => {
      if (!post) {
        const error = new Error("post not found");
        error.statusCode = 401;
        throw error;
      }

      postData = post;

      return User.findById(postData.user);
    })
    .then((user) => {
      if (!user) {
        const error = new Error("user not found");
        error.statusCode = 401;
        throw error;
      }

      user.posts.pop(postId);
      return user.save();
    })
    .then((result) => {
      if (!result) {
        const error = new Error("Not found");
        error.statusCode = 401;
        throw error;
      }

      return PostCategory.findById(postData.category);
    })
    .then((PostCategoryData) => {
      if (!PostCategoryData) {
        const error = new Error("Postcategory Not found");
        error.statusCode = 401;
        throw error;
      }

      PostCategoryData.posts.pop(postId);
      return PostCategoryData.save();
    })
    .then((result) => {
      if (!result) {
        const error = new Error("server error");
        error.statusCode = 401;
        throw error;
      }

      return Post.findByIdAndDelete(postId);
    })
    .then((post) => {
      if (!post) {
        const error = new Error("server error");
        error.statusCode = 401;
        throw error;
      }

      return Post.find({ user: req.userId, status: "Delete" }).countDocuments();
    })
    .then((count) => {
      totalPost = count;
      return Post.find({ user: req.userId, status: "Delete" })
        .sort({ createdAt: -1 })
        .limit(postPerPage);
    })
    .then((posts) => {
      if (!posts) {
        const error = new Error("server error");
        error.statusCode = 401;
        throw error;
      }

      totalPage = Math.ceil(totalPost / postPerPage);

      const postData = posts.map((data) => {
        return {
          imageUrl: data.image,
          desc: data.title,
          postId: data._id,
          totalPage: totalPage,
        };
      });

      res.status(200).json({ message: "post get done", postData: postData });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};



exports.likePost = async (req, res) => {
  const postId  = req.body.postId;
  console.log(postId);
  const userId = req.userId; 

  try {
    const post = await Post.findById(postId);

    
    if (!post.likes.includes(userId)) {
      post.likes.push(userId);
      await post.save();
      res.status(200).json({ message: "Post liked!", likes: post.likes.length });
    } else {
      res.status(400).json({ message: "Post already liked by this user" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error liking post", error });
  }
};


exports.unlikePost = async (req, res) => {
  const  postId  = req.body.postId;
  const userId = req.userId;

  try {
    const post = await Post.findById(postId);

    
    if (post.likes.includes(userId)) {
      post.likes = post.likes.filter((id) => id.toString() !== userId);
      await post.save();
      res.status(200).json({ message: "Post unliked!", likes: post.likes.length });
    } else {
      res.status(400).json({ message: "Post not liked by this user" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error unliking post", error });
  }
};

exports.addComment = async (req,res) => {
  try {
    const  postId  = req.body.postId;
    const  text = req.body.text;
    const userId = req.userId;

    const user = await User.findById(userId);

    const post = await Post.findById(postId);
    post.comments.push({ user: userId, text, name: user.name });
    await post.save();

    res.status(201).json(post.comments);
  } catch (error) {
    res.status(500).json({ error: "Could not add comment" });
  }
}

exports.getComment = async (req, res) => {
  try {
    const  {postId}  = req.params;

    const post = await Post.findById(postId).populate("comments.user", "username");
    res.json(post.comments);
  } catch (error) {
    res.status(500).json({ error: "Could not fetch comments" });
  }
}
const mongoos = require("mongoose");

const Schema = mongoos.Schema;

const postSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  desc: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  category: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "PostCategory",
  },
  imgSource: {
    type: String,
    required: true,
  },
  tag: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  imageName: {
    type: String,
    required: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  views: {
    type: Number,
    default: 0,
  },
  likes: { 
    type: [Schema.Types.ObjectId], 
    ref: "User", 
    default: [] 
  },
  comments: [
    {
      user: { type: Schema.Types.ObjectId, ref: "User", required: true },
      name: {type: String, required: true},
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
});

module.exports = mongoos.model("Posts", postSchema);

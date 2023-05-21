//jshint esversion:6
require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const encrypt = require("mongoose-encryption");

const app = express();
const port = process.env.PORT || 3000;

// console.log(process.env.SECRET);

app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

main().catch((err) => console.log(err));
async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/userDB");
}
//Created Schema
const usersSchema = new mongoose.Schema({
  email: String,
  password: String,
});


usersSchema.plugin(encrypt, {
  secret: process.env.SECRET,
  encryptedFields: ["password"],
  excludeFromEncryption: ["email"],
});

//Created model
const User = mongoose.model("User", usersSchema);

app.get("/", (req, res) => {
  res.render("home");
});
app.get("/login", (req, res) => {
  res.render("login");
});
app.get("/register", (req, res) => {
  res.render("register");
});
app.post("/register", (req, res) => {
  const newUser = new User({
    email: req.body.username,
    password: req.body.password,
  });
  newUser
    .save()
    .then(res.render("secrets"))
    .catch((err) => console.log(err));
});

app.post("/login", function (req, res) {
  const username = req.body.username;
  const password = req.body.password;
  User.findOne({ email: username }) //your email is encrypted so it's not comparable here
    .then((foundUser) => {
      if (foundUser) {
        if (foundUser.password === password) {
          res.render("secrets");
        } else {
          // res.write("wrong password please try again");
          res.render("login");
        }
      } else {
        // res.write("no user found.please first signup");
        res.render("register");
      }
    })
    .catch((err) => console.error(err));
});

app.listen(port, function (req, res) {
  console.log(`Server is listening on port ${port}.`);
});

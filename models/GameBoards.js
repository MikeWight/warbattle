const mongoose = require("mongoose");
const { Schema } = mongoose;

const gameBoardSchema = new Schema({
  winner: String,
  time: { type: Date, default: Date.now },
  playerOne: String,
  playerTwo: String
});

mongoose.model("gameBoard", gameBoardSchema);

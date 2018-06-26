var express = require("express");
var app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);
const bodyParser = require("body-parser");

//This is the mongo stuff
require("./models/GameBoards");
var mongoose = require("mongoose");
const GameBoards = mongoose.model("gameBoard");

const keys = require("./keys/keys.js");
mongoose.connect(keys.mongoURI);
//End of mongo stuff

var nickname;

io.on("connection", socket => {
  console.log("Socketio Connection by: " + nickname);

  socket.nickname = nickname;

  getGameBoard(socket);

  socket.on("restart", () => {
    getGameBoard(socket);
  });

  socket.on("disconnect", () => {
    console.log(
      socket.nickname + " disconected from board: " + socket.gameBoardId
    );
    deleteGameBoard(socket);
  });
});

app.use(
  bodyParser.urlencoded({
    extended: true
  })
);
app.use(bodyParser.json());

app.use(express.static("images"));

app.post("/gameboard", (req, res) => {
  nickname = req.body.name;

  if (nickname) {
    res.sendFile(__dirname + "/warboard.html");
  } else {
    res.sendFile(__dirname + "/index.html");
  }
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("*", function(req, res) {
  res.sendFile(__dirname + "/index.html");
});

const PORT = process.env.PORT || 5050;
http.listen(PORT, () => {
  console.log("listening on *:" + PORT);
});

getGameBoard = async socket => {
  var result = await GameBoards.findOne({ playerTwo: null });
  var result2 = await GameBoards.findOne({ playerOne: null });
  if (result) {
    console.log("getGameBoard - Board without a second player!");
    socket.gameBoardId = result._id;
    var updateData = {
      playerTwo: socket.nickname
    };
    await GameBoards.update({ _id: result._id }, updateData, (err, afected) => {
      console.log("GameBoard now has two players");
    });
    emitGameStart(result.playerOne, socket.nickname, socket);
  } else if (result2) {
    console.log("getGameBoard - Board without a first player!");
    socket.gameBoardId = result2._id;
    var updateData = {
      playerOne: socket.nickname
    };
    await GameBoards.update(
      { _id: result2._id },
      updateData,
      (err, afected) => {
        console.log("GameBoard now has two players");
      }
    );
    emitGameStart(socket.nickname, result2.playerTwo, socket);
  } else {
    console.log("getGameBoard - new Board!");
    var gameBoard = await new GameBoards({
      playerOne: socket.nickname
    }).save();
    socket.gameBoardId = gameBoard._id;
    emitGameStart(socket.nickname, null, socket);
  }
};

emitGameStart = (playerOneNickname, playerTwoNickname, socket) => {
  socket.join(socket.gameBoardId);
  io.sockets.in(socket.gameBoardId).emit("player-entered", {
    playerOneName: playerOneNickname,
    playerTwoName: playerTwoNickname
  });
  if (playerOneNickname && playerTwoNickname) {
    console.log("Game is ready to start!");
    var counter = 3;
    socket.WinnerCountdown = setInterval(() => {
      io.sockets.in(socket.gameBoardId).emit("counter", counter);
      counter--;
      if (counter === -1) {
        io.sockets
          .in(socket.gameBoardId)
          .emit("counter", "Congratulations You WON!!");
        clearInterval(socket.WinnerCountdown);
      }
    }, 1000);
  } else {
    if (socket.WinnerCountdown) {
      clearInterval(socket.WinnerCountdown);
      io.sockets.in(socket.gameBoardId).emit("counter", "Someone left!");
    }
  }
};

deleteGameBoard = async socket => {
  var theBoard = await GameBoards.findById({ _id: socket.gameBoardId });

  if (theBoard) {
    if (theBoard.playerOne == null || theBoard.playerTwo == null) {
      await GameBoards.findOneAndRemove({ _id: socket.gameBoardId });
    } else {
      var updateData;
      if (theBoard.playerOne == socket.nickname) {
        updateData = {
          playerOne: null
        };
        io.sockets.in(socket.gameBoardId).emit("player-entered", {
          playerOneName: null,
          playerTwoName: theBoard.playerTwo
        });
      } else {
        updateData = {
          playerTwo: null
        };
        io.sockets.in(socket.gameBoardId).emit("player-entered", {
          playerOneName: theBoard.playerOne,
          playerTwoName: null
        });
      }

      var newBoard = await GameBoards.update(
        { _id: socket.gameBoardId },
        updateData,
        (err, afected) => {
          console.log("Gameboard lost a player");
        }
      );
      if (socket.WinnerCountdown) {
        clearInterval(socket.WinnerCountdown);
        io.sockets.in(socket.gameBoardId).emit("counter", "Someone left!");
      }
    }
  }
};

getRandomInt = max => {
  return Math.floor(Math.random() * Math.floor(max));
};

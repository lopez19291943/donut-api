const express = require("express");
const fs = require("fs");
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

/* =========================
   USERS SAVE FILE
========================= */
const USERS_FILE = "./users.json";
let users = {};

if(fs.existsSync(USERS_FILE)){
    users = JSON.parse(fs.readFileSync(USERS_FILE));
}else{
    fs.writeFileSync(USERS_FILE, JSON.stringify({}));
}

function save(){
    fs.writeFileSync(USERS_FILE, JSON.stringify(users,null,2));
}

/* =========================
   VERIFY SYSTEM
========================= */
const verifyCodes = new Map();

function genCode(){
    return Math.random().toString(36).substring(2,8).toUpperCase();
}

app.post("/api/request-code",(req,res)=>{
    const code = genCode();
    verifyCodes.set(code,null);
    console.log("CODE:",code);
    res.json({code});
});

app.post("/api/verify",(req,res)=>{
    const {code,player} = req.body;

    if(!verifyCodes.has(code)){
        console.log("❌ invalid code");
        return res.json({success:false});
    }

    verifyCodes.set(code,player);

    if(!users[player]){
        users[player]={balance:0};
        save();
    }

    console.log("✅ VERIFIED:",player);
    res.json({success:true});
});

app.get("/api/verify-status/:code",(req,res)=>{
    const code=req.params.code;

    if(!verifyCodes.has(code)) return res.json({verified:false});
    const player=verifyCodes.get(code);
    if(!player) return res.json({verified:false});

    res.json({verified:true,player});
});

/* =========================
   BALANCE
========================= */
app.get("/api/status/:player",(req,res)=>{
    const p=req.params.player;

    if(!users[p]){
        users[p]={balance:0};
        save();
    }

    res.json({
        verified:true,
        balance:users[p].balance
    });
});

/* =========================
   DEPOSIT FROM MC
========================= */
app.post("/api/deposit",(req,res)=>{
    const {player,amount}=req.body;

    if(!users[player]){
        users[player]={balance:0};
    }

    users[player].balance += Number(amount);
    save();

    console.log("💰 DEPOSIT:",player,amount);

    res.json({success:true,newBalance:users[player].balance});
});

let pendingWithdraw=null;

app.post("/api/withdraw-to-mc",(req,res)=>{
    const {webUser,amount,targetPlayer}=req.body;

    const player = webUser || targetPlayer;

    if(!users[player]) return res.json({success:false});
    if(users[player].balance < amount) return res.json({success:false,error:"no money"});

    users[player].balance -= Number(amount);
    save();

    pendingWithdraw={
        id:Date.now().toString(),
        player,
        amount
    };

    console.log("📤 WITHDRAW REQUEST:",player,amount);

    res.json({success:true});
});

/* =========================
   MOD CHECK WITHDRAW
========================= */
app.get("/api/next-withdraw",(req,res)=>{
    if(!pendingWithdraw) return res.json({success:false});

    res.json({
        success:true,
        id:pendingWithdraw.id,
        player:pendingWithdraw.player,
        amount:pendingWithdraw.amount
    });
});

/* =========================
   CONFIRM AFTER /PAY
========================= */
app.post("/api/complete/:id",(req,res)=>{
    if(!pendingWithdraw) return res.json({success:false});

    console.log("✅ WITHDRAW COMPLETE:",pendingWithdraw.player,pendingWithdraw.amount);
    pendingWithdraw=null;

    res.json({success:true});
});

app.listen(3000,()=>console.log("🚀 SERVER http://localhost:3000"));
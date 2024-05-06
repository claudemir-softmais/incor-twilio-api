const MessagingResponse = require("twilio").twiml.MessagingResponse;
const mysql = require('mysql2');
const express = require("express");
const app = express();
const port = process.env.PORT || 4537;
const dotenv = require('dotenv');
dotenv.config();

const pool = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASS,
  database: process.env.DATABASE,
});

// Encerrar a conexão com o banco de dados quando o aplicativo é encerrado
process.on('SIGINT', () => {
  pool.end(err => {
    if (err) {
      console.error('Erro ao encerrar o pool de conexão:', err);
    }
    process.exit(0);
  });
});

app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname + '/public'));

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <link rel="stylesheet" type="text/css" href="style.css">
      </head>
      <body>
        <img class='pulsing-image' src="Logo.png" alt="Descrição da imagem">
      </body>
    </html>
  `);
});

// insere no banco MYSQL
const insertResponse = async (idSchedule, whatsappReply, WaId) => {
  try {
    await pool.promise().execute(
      "INSERT INTO respostas_whatsapp (ID_SEQUENCIA, CELULAR, RESPOSTA_WHATSAPP) VALUES (?, ?, ?)",
      [idSchedule, WaId, whatsappReply]
    );
    console.log('Mensagem inserida com sucesso no banco de dados');
  } catch (err) {
    console.error('Erro ao inserir mensagem no banco de dados:', err);
    throw err;
  }
};

// verifica se existe no banco de dados MYSQL com o ID e o NUMERO DE TELEFONEs 
const checkIDSequence = async (idSchedule, whatsappReply, WaId) => {
  try {
    const [rows] = await pool.promise().query(
      "SELECT ID_SEQUENCIA FROM respostas_whatsapp WHERE ID_SEQUENCIA = ? AND CELULAR = ?",
      [idSchedule, WaId]
    );
    if (rows.length === 0) {
      await insertResponse(idSchedule, whatsappReply, WaId);
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.error('Erro ao executar a consulta SQL:', err);
    throw err;
  }
};

app.post("/message/receive", async (req, res) => {
  const response = new MessagingResponse();
  const incomingMessage = req.body.Body;
  let whatsappReply = '';
  let idSchedule = '';
  let replyMessage = '';
  //pega o numero de telefone
  const {WaId} = req.body;
  console.log(WaId);

  if (incomingMessage.includes('Confirmar')) {
    whatsappReply = 'S';
    idSchedule = req.body.ButtonPayload.substring(3);
  } else if (incomingMessage.includes('Cancelar')) {
    whatsappReply = 'N';
    idSchedule = req.body.ButtonPayload.substring(3);
  }
  try {
    if (whatsappReply !== '') {
      const result = await checkIDSequence(idSchedule, whatsappReply, WaId); //mando o numero de telefone para verificar
      if (!result) {
        replyMessage = `Exame já ${whatsappReply === 'S' ? 'CANCELADO' : 'CONFIRMADO'}, entre em contato pelo telefone (18)3902-6060 para alterar!`;
        console.log('recebeu resposta 1');
      } else {
        replyMessage = `Muito obrigado *${req.body.ProfileName}*! Exame ${whatsappReply === 'S' ? 'CONFIRMADO ✅' : 'CANCELADO ❌'}!`;
        console.log('recebeu resposta 2');
      }
    } else if (incomingMessage.includes('Falar com atendente')) {
      replyMessage = req.body.ButtonPayload;
      console.log('clicou em falar com atendente');
    } else {
      console.log('escreveu qualquer coisa');
      replyMessage = 'Escolha uma das opções ou entre em contato pelo telefone (18)3902-6060';
    }
  } catch (err) {
    console.error('Erro:', err);
    replyMessage = `Erro ao ${whatsappReply !== '' ? 'confirmar/cancelar' : 'processar'} o exame. Por favor, tente novamente.`;
  }

  response.message(replyMessage);
  res.set("Content-Type", "text/xml");
  res.send(response.toString());
});

app.listen(port, () => {
  console.log(`Servidor escutando http://localhost:${port}`);
});

const listPrinters = () => {
  qz.websocket
    .connect()
    .then(() => qz.printers.find())
    .then((printers) =>
      alert("Impressoras encontradas:\n" + printers.join("\n"))
    )
    .catch((err) => alert("Erro: " + err))
    .finally(() => qz.websocket.disconnect());
};

const printNFe = () => {
  qz.websocket
    .connect()
    .then(() => {
      return qz.printers.find("Microsoft Print to PDF");
    })
    .then((found) => {
      let config = qz.configs.create(found);
      let nfe = "./danfe.pdf";
      let data = [
        {
          type: "pixel",
          format: "pdf",
          flavor: "file",
          data: nfe,
        },
      ];
      return qz.print(config, data);
    })
    .catch((e) => {
      alert(e);
    })
    .finally(() => {
      return qz.websocket.disconnect();
    });
};

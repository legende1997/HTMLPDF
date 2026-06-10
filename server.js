const express = require('express');
const puppeteer = require('puppeteer');
const app = express();

app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.send('Servidor HTML para PDF funcionando!');
});

app.post('/convert', async (req, res) => {
  const { html } = req.body;

  if (!html) {
    return res.status(400).json({ error: 'Campo html é obrigatório' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });

    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="etiqueta.pdf"',
    });

    res.send(pdf);
  } catch (error) {
    if (browser) await browser.close();
    console.error(error);
    res.status(500).json({ error: 'Erro ao converter HTML para PDF' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

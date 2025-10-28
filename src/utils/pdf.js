const PDFDocument = require('pdfkit');

function generateOverviewPDF({ month, users, settings }, res) {
  const doc = new PDFDocument({ margin: 36 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=mess-overview-${month}.pdf`);
  doc.pipe(res);

  // Header
  doc.fontSize(20).text(settings.brandName || 'Mess Manager', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Monthly Overview - ${month}`, { align: 'center' });
  doc.moveDown();

  // Table header
  const startX = 50; let y = doc.y;
  doc.fontSize(11).text('Name', startX, y, { width: 180 });
  doc.text('Meals', startX + 190, y, { width: 60 });
  doc.text('Spent', startX + 260, y, { width: 80 });
  doc.text('Balance', startX + 350, y, { width: 80 });
  doc.moveDown();

  users.forEach(u => {
    y = doc.y;
    doc.text(u.name, startX, y, { width: 180 });
    doc.text(String(u.totalMeals || 0), startX + 190, y, { width: 60 });
    doc.text(`${(u.totalCost || 0).toFixed(2)}`, startX + 260, y, { width: 80 });
    doc.text(`${(u.balance || 0).toFixed(2)}`, startX + 350, y, { width: 80 });
    doc.moveDown(0.5);
  });

  doc.end();
}

module.exports = { generateOverviewPDF };

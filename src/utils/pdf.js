const PDFDocument = require('pdfkit');

function currency(n) { try { return new Intl.NumberFormat('en-BD', { style:'currency', currency:'BDT', maximumFractionDigits: 2 }).format(Number(n||0)) } catch { return `৳${Number(n||0).toFixed(2)}` } }

function generateOverviewPDF({ month, users, settings }, res) {
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=mess-overview-${month}.pdf`);
  doc.pipe(res);

  // Header band
  const brand = settings.brandName || 'Mess Manager';
  doc.rect(36, 36, doc.page.width - 72, 60).fill('#0F766E');
  doc.fillColor('#FFFFFF').fontSize(20).text(brand, 46, 50, { width: doc.page.width - 92, align: 'left' });
  doc.fontSize(12).text(`Monthly Overview — ${month}`, { align: 'right' });
  doc.moveDown(2);
  doc.fillColor('#000000');

  // Summary box
  const mealCost = settings?.mealCost || 0;
  const totalMeals = users.reduce((s,u)=>s+(u.totalMeals||0),0);
  const totalSpent = users.reduce((s,u)=>s+(u.totalCost||0),0);
  const avgPerUser = users.length ? totalSpent/users.length : 0;
  const topSpacing = 110;
  doc.roundedRect(36, topSpacing, doc.page.width - 72, 70, 8).stroke('#0F766E');
  doc.fontSize(11);
  doc.text(`Meal Cost: ${currency(mealCost)}`, 46, topSpacing + 10, { continued: true }).text(`  Users: ${users.length}`);
  doc.text(`Total Meals: ${totalMeals}`, 46, topSpacing + 28, { continued: true }).text(`  Total Spent: ${currency(totalSpent)}`);
  doc.text(`Avg per User: ${currency(avgPerUser)}`, 46, topSpacing + 46);

  // Table header
  let y = topSpacing + 90;
  const cols = [
    { key:'name', title:'Name', width: 160, align:'left' },
    { key:'totalMeals', title:'Meals', width: 50, align:'right' },
    { key:'mealUnitPrice', title:'Price', width: 55, align:'right', fmt:(v)=>currency(v) },
    { key:'mealsCost', title:'Meals Cost', width: 80, align:'right', fmt:(v)=>currency(v) },
    { key:'sharedShare', title:'Shared', width: 70, align:'right', fmt:(v)=>currency(v) },
    { key:'totalCost', title:'Total', width: 75, align:'right', fmt:(v)=>currency(v) },
    { key:'balance', title:'Balance', width: 70, align:'right', fmt:(v)=>currency(v) },
    { key:'due', title:'Due', width: 60, align:'right', fmt:(v)=>currency(v) },
  ];
  const startX = 46;
  doc.rect(startX-10, y-6, doc.page.width - 92, 24).fill('#E0F2F1');
  doc.fillColor('#0F766E').fontSize(11);
  let x = startX;
  cols.forEach(c => { doc.text(c.title, x, y, { width: c.width, align: c.align }); x += c.width + 10; });
  doc.fillColor('#000000');
  y += 22;

  // Rows
  users.forEach((u, idx) => {
    const rowY = y + idx * 20;
    if (idx % 2 === 0) { doc.rect(startX-10, rowY-4, doc.page.width - 92, 20).fill('#FAFAFA'); doc.fillColor('#000000'); }
    x = startX;
    const row = {
      name: u.name,
      totalMeals: u.totalMeals || 0,
      mealUnitPrice: u.mealUnitPrice || mealCost,
      mealsCost: u.mealsCost || ((u.totalMeals||0)*mealCost),
      sharedShare: u.sharedShare || 0,
      totalCost: u.totalCost || 0,
      balance: u.balance || 0,
      due: u.due || ((u.totalCost||0) - (u.balance||0)),
    };
    cols.forEach(c => {
      const val = c.fmt ? c.fmt(row[c.key]) : String(row[c.key] ?? '');
      doc.text(val, x, rowY, { width: c.width, align: c.align });
      x += c.width + 10;
    });
  });

  // Totals row
  const totalsY = y + users.length * 20 + 6;
  const sumMealsCost = users.reduce((s,u)=>s+(u.mealsCost||((u.totalMeals||0)*mealCost)),0);
  const sumShared = users.reduce((s,u)=>s+(u.sharedShare||0),0);
  doc.moveTo(startX-10, totalsY).lineTo(doc.page.width-46, totalsY).stroke('#B2DFDB');
  doc.fontSize(11).fillColor('#0F766E');
  doc.text('Totals', startX, totalsY + 8, { width: 160 });
  doc.text(String(totalMeals), startX + 170, totalsY + 8, { width: 50, align:'right' });
  doc.text(currency(mealCost), startX + 230, totalsY + 8, { width: 55, align:'right' });
  doc.text(currency(sumMealsCost), startX + 295, totalsY + 8, { width: 80, align:'right' });
  doc.text(currency(sumShared), startX + 385, totalsY + 8, { width: 70, align:'right' });
  doc.text(currency(totalSpent + sumShared), startX + 465, totalsY + 8, { width: 75, align:'right' });
  doc.fillColor('#000000');

  // Insights section
  const insightsY = totalsY + 28;
  const byDue = [...users].map(u=>({ name:u.name, due:u.due||((u.totalCost||0)-(u.balance||0)) })).sort((a,b)=> (b.due||0)-(a.due||0));
  const topDue = byDue.slice(0,5);
  doc.fontSize(11).fillColor('#0F766E').text('Top Outstanding Dues', 36, insightsY);
  doc.fillColor('#000');
  topDue.forEach((u,i)=>{ doc.text(`${i+1}. ${u.name}: ${currency(u.due||0)}`, 46, insightsY + 16 + i*14); });

  // Footer
  doc.fontSize(9).fillColor('#666').text(`Generated at ${new Date().toLocaleString()} • Counting Rule: ${settings?.countingRule || 'perMealHalf'}`, 36, doc.page.height - 40, { align:'center', width: doc.page.width - 72 });

  doc.end();
}

module.exports = { generateOverviewPDF };

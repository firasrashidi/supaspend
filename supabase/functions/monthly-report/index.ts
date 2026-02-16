import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const fmtCurrency = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Parse params ──
    const url = new URL(req.url);
    const groupId = url.searchParams.get("group_id");
    const month = parseInt(url.searchParams.get("month") || "0", 10);
    const year = parseInt(url.searchParams.get("year") || "0", 10);

    if (!groupId || !month || !year) {
      return new Response(
        JSON.stringify({ error: "Missing group_id, month, or year" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch data ──
    const { data: group } = await supabase
      .from("groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (!group) {
      return new Response(
        JSON.stringify({ error: "Group not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    const [budgetResult, txResult] = await Promise.all([
      supabase
        .from("group_budgets")
        .select("*")
        .eq("group_id", groupId)
        .eq("month", month)
        .eq("year", year)
        .order("category"),
      supabase
        .from("transactions")
        .select("*")
        .eq("group_id", groupId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false }),
    ]);

    const budgetList = budgetResult.data || [];
    const txList = txResult.data || [];

    // ══════════════════════════════════════
    //  BUILD PDF
    // ══════════════════════════════════════
    const pdf = await PDFDocument.create();
    const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const W = 595.28; // A4 width in pt
    const H = 841.89; // A4 height
    const M = 50; // margin
    const CW = W - 2 * M; // content width
    const FOOTER_ZONE = 48; // space reserved for footer

    // Colors
    const cGreen = rgb(0.133, 0.545, 0.133);
    const cDarkGreen = rgb(0.067, 0.333, 0.067);
    const cBlack = rgb(0, 0, 0);
    const cGray = rgb(0.45, 0.45, 0.45);
    const cLightGray = rgb(0.93, 0.93, 0.93);
    const cRed = rgb(0.75, 0.22, 0.17);
    const cWhite = rgb(1, 1, 1);
    const cRowAlt = rgb(0.97, 0.97, 0.97);

    let page = pdf.addPage([W, H]);
    let y = H - M;

    /** Ensure enough vertical space; returns true when a new page was added */
    const ensureSpace = (needed: number): boolean => {
      if (y - needed < FOOTER_ZONE) {
        page = pdf.addPage([W, H]);
        y = H - M;
        return true;
      }
      return false;
    };

    /** Draw text on the current page */
    const text = (
      str: string,
      x: number,
      yPos: number,
      opts: {
        font?: typeof helvetica;
        size?: number;
        color?: ReturnType<typeof rgb>;
      } = {}
    ) => {
      page.drawText(str, {
        x,
        y: yPos,
        font: opts.font ?? helvetica,
        size: opts.size ?? 10,
        color: opts.color ?? cBlack,
      });
    };

    // ───────────────────────────────
    //  HEADER BANNER
    // ───────────────────────────────
    page.drawRectangle({
      x: M,
      y: y - 55,
      width: CW,
      height: 55,
      color: cGreen,
    });

    text("SupaSpend", M + 14, y - 22, {
      font: helveticaBold,
      size: 18,
      color: cWhite,
    });
    text("Monthly Report", M + 14, y - 40, {
      size: 10,
      color: rgb(0.82, 0.94, 0.82),
    });

    const monthYearStr = `${MONTHS[month - 1]} ${year}`;
    const myw = helveticaBold.widthOfTextAtSize(monthYearStr, 15);
    text(monthYearStr, M + CW - 14 - myw, y - 22, {
      font: helveticaBold,
      size: 15,
      color: cWhite,
    });

    const gnw = helvetica.widthOfTextAtSize(group.name, 10);
    text(group.name, M + CW - 14 - gnw, y - 40, {
      size: 10,
      color: rgb(0.82, 0.94, 0.82),
    });

    y -= 70;

    // Generated date
    text(
      `Generated ${new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`,
      M,
      y,
      { size: 8, color: cGray }
    );
    y -= 28;

    // ───────────────────────────────
    //  BUDGET OVERVIEW
    // ───────────────────────────────
    text("Budget Overview", M, y, {
      font: helveticaBold,
      size: 13,
      color: cDarkGreen,
    });
    y -= 5;
    page.drawLine({
      start: { x: M, y },
      end: { x: M + CW, y },
      thickness: 1.5,
      color: cGreen,
    });
    y -= 18;

    if (budgetList.length === 0) {
      text("No budgets set for this month.", M, y, { size: 10, color: cGray });
      y -= 25;
    } else {
      // Column layout
      const bCols = [
        { label: "Budget", x: M },
        { label: "Limit", x: M + 160 },
        { label: "Spent", x: M + 265 },
        { label: "Remaining", x: M + 365 },
        { label: "Used", x: M + 460 },
      ];

      const drawBudgetHeader = () => {
        page.drawRectangle({
          x: M,
          y: y - 4,
          width: CW,
          height: 18,
          color: cLightGray,
        });
        for (const c of bCols) {
          text(c.label, c.x + 5, y, {
            font: helveticaBold,
            size: 9,
            color: cGray,
          });
        }
        y -= 20;
      };

      drawBudgetHeader();

      let totalLimit = 0;
      let totalSpent = 0;

      for (let i = 0; i < budgetList.length; i++) {
        const newPage = ensureSpace(18);
        if (newPage) drawBudgetHeader();

        const b = budgetList[i];
        const matching = txList.filter(
          (t: any) => t.category?.toLowerCase() === b.category.toLowerCase()
        );
        const expenses = matching
          .filter((t: any) => t.type === "expense")
          .reduce((s: number, t: any) => s + (t.converted_amount ?? t.amount), 0);
        const income = matching
          .filter((t: any) => t.type === "income")
          .reduce((s: number, t: any) => s + (t.converted_amount ?? t.amount), 0);
        const effectiveLimit = b.amount_limit + income;
        const spent = expenses;
        const remaining = Math.max(0, effectiveLimit - spent);
        const pct = effectiveLimit > 0 ? (spent / effectiveLimit) * 100 : 0;

        totalLimit += effectiveLimit;
        totalSpent += spent;

        if (i % 2 === 0) {
          page.drawRectangle({
            x: M,
            y: y - 4,
            width: CW,
            height: 16,
            color: cRowAlt,
          });
        }

        text(b.category, bCols[0].x + 5, y, { size: 9 });
        text(fmtCurrency(effectiveLimit, b.currency), bCols[1].x + 5, y, {
          size: 9,
        });
        text(fmtCurrency(spent, b.currency), bCols[2].x + 5, y, {
          size: 9,
          color: spent > 0 ? cRed : cBlack,
        });
        text(fmtCurrency(remaining, b.currency), bCols[3].x + 5, y, {
          size: 9,
          color: remaining > 0 ? cGreen : cRed,
        });
        const pctColor =
          pct > 90 ? cRed : pct > 70 ? rgb(0.75, 0.55, 0) : cGreen;
        text(`${pct.toFixed(0)}%`, bCols[4].x + 5, y, {
          size: 9,
          font: helveticaBold,
          color: pctColor,
        });

        y -= 18;
      }

      // Totals row
      ensureSpace(30);
      page.drawLine({
        start: { x: M, y: y + 4 },
        end: { x: M + CW, y: y + 4 },
        thickness: 0.5,
        color: cGray,
      });
      y -= 14;

      text("TOTAL", bCols[0].x + 5, y, {
        font: helveticaBold,
        size: 9,
      });
      text(fmtCurrency(totalLimit, "USD"), bCols[1].x + 5, y, {
        font: helveticaBold,
        size: 9,
      });
      text(fmtCurrency(totalSpent, "USD"), bCols[2].x + 5, y, {
        font: helveticaBold,
        size: 9,
        color: cRed,
      });
      const totalRem = Math.max(0, totalLimit - totalSpent);
      text(fmtCurrency(totalRem, "USD"), bCols[3].x + 5, y, {
        font: helveticaBold,
        size: 9,
        color: totalRem > 0 ? cGreen : cRed,
      });
      const totalPct =
        totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
      text(`${totalPct.toFixed(0)}%`, bCols[4].x + 5, y, {
        font: helveticaBold,
        size: 9,
      });

      y -= 25;
    }

    // ───────────────────────────────
    //  TRANSACTION DETAILS
    // ───────────────────────────────
    ensureSpace(40);
    text("Transaction Details", M, y, {
      font: helveticaBold,
      size: 13,
      color: cDarkGreen,
    });
    y -= 5;
    page.drawLine({
      start: { x: M, y },
      end: { x: M + CW, y },
      thickness: 1.5,
      color: cGreen,
    });
    y -= 18;

    if (txList.length === 0) {
      text("No transactions for this month.", M, y, {
        size: 10,
        color: cGray,
      });
    } else {
      const tCols = [
        { label: "Date", x: M },
        { label: "Merchant", x: M + 75 },
        { label: "Budget", x: M + 230 },
        { label: "Type", x: M + 345 },
        { label: "Amount", x: M + 415 },
      ];

      const drawTxHeader = () => {
        page.drawRectangle({
          x: M,
          y: y - 4,
          width: CW,
          height: 18,
          color: cLightGray,
        });
        for (const c of tCols) {
          text(c.label, c.x + 5, y, {
            font: helveticaBold,
            size: 9,
            color: cGray,
          });
        }
        y -= 20;
      };

      drawTxHeader();

      let totalIncome = 0;
      let totalExpenses = 0;

      for (let i = 0; i < txList.length; i++) {
        const newPage = ensureSpace(18);
        if (newPage) drawTxHeader();

        const t = txList[i];
        const txAmt = t.converted_amount ?? t.amount;
        if (t.type === "expense") totalExpenses += txAmt;
        else totalIncome += txAmt;

        if (i % 2 === 0) {
          page.drawRectangle({
            x: M,
            y: y - 4,
            width: CW,
            height: 16,
            color: cRowAlt,
          });
        }

        const dateStr = new Date(t.date + "T00:00:00").toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric" }
        );

        // Truncate merchant if it overflows the column
        let merchant = t.merchant || "";
        const maxMerchantW = tCols[2].x - tCols[1].x - 15;
        if (helvetica.widthOfTextAtSize(merchant, 9) > maxMerchantW) {
          while (
            helvetica.widthOfTextAtSize(merchant + "...", 9) > maxMerchantW &&
            merchant.length > 1
          ) {
            merchant = merchant.slice(0, -1);
          }
          merchant += "...";
        }

        text(dateStr, tCols[0].x + 5, y, { size: 9 });
        text(merchant, tCols[1].x + 5, y, { size: 9 });
        text(t.category || "No budget", tCols[2].x + 5, y, {
          size: 9,
          color: t.category ? cBlack : cGray,
        });
        text(t.type === "expense" ? "Expense" : "Income", tCols[3].x + 5, y, {
          size: 9,
          color: t.type === "expense" ? cRed : cGreen,
        });

        const amtStr = fmtCurrency(t.amount, t.currency);
        text(amtStr, tCols[4].x + 5, y, {
          size: 9,
          font: helveticaBold,
          color: t.type === "expense" ? cRed : cGreen,
        });

        y -= 18;
      }

      // Summary row
      ensureSpace(35);
      page.drawLine({
        start: { x: M, y: y + 4 },
        end: { x: M + CW, y: y + 4 },
        thickness: 0.5,
        color: cGray,
      });
      y -= 14;

      text(`${txList.length} transactions`, M + 5, y, {
        font: helveticaBold,
        size: 9,
      });
      text(`Income: ${fmtCurrency(totalIncome, "USD")}`, M + 180, y, {
        font: helveticaBold,
        size: 9,
        color: cGreen,
      });
      text(`Expenses: ${fmtCurrency(totalExpenses, "USD")}`, M + 330, y, {
        font: helveticaBold,
        size: 9,
        color: cRed,
      });
    }

    // ───────────────────────────────
    //  FOOTER (every page)
    // ───────────────────────────────
    const allPages = pdf.getPages();
    const footerLabel = `SupaSpend  -  ${group.name}  -  ${MONTHS[month - 1]} ${year}`;

    for (let i = 0; i < allPages.length; i++) {
      const p = allPages[i];
      p.drawLine({
        start: { x: M, y: 38 },
        end: { x: W - M, y: 38 },
        thickness: 0.5,
        color: cLightGray,
      });
      p.drawText(footerLabel, {
        x: M,
        y: 27,
        font: helvetica,
        size: 7,
        color: cGray,
      });
      const pn = `Page ${i + 1} of ${allPages.length}`;
      const pnw = helvetica.widthOfTextAtSize(pn, 7);
      p.drawText(pn, {
        x: W - M - pnw,
        y: 27,
        font: helvetica,
        size: 7,
        color: cGray,
      });
    }

    // ── Serialize & respond ──
    const pdfBytes = await pdf.save();
    const safeName = group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const fileName = `supaspend-${safeName}-${MONTHS[month - 1].toLowerCase()}-${year}.pdf`;

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { messages, groupId } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: "messages is required" }, { status: 400 });
    }

    // Authenticate user via Supabase cookies
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch transactions for the active group (cap at 200 most recent)
    let query = supabase
      .from("transactions")
      .select("date, type, amount, currency, merchant, category, converted_amount, converted_currency")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(200);

    if (groupId) {
      query = query.eq("group_id", groupId);
    }

    const { data: transactions } = await query;
    const txList = transactions || [];

    // Fetch budgets for the group if provided
    let budgetSummary = "";
    if (groupId) {
      const now = new Date();
      const { data: budgets } = await supabase
        .from("group_budgets")
        .select("category, amount_limit, currency")
        .eq("group_id", groupId)
        .eq("month", now.getMonth() + 1)
        .eq("year", now.getFullYear());

      if (budgets && budgets.length > 0) {
        budgetSummary =
          "\n\nCurrent month budgets:\n" +
          budgets
            .map((b) => `- ${b.category}: ${b.amount_limit} ${b.currency}`)
            .join("\n");
      }
    }

    // Build compact transaction summary
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const thisMonthTx = txList.filter((t) => t.date.startsWith(thisMonth));
    const totalExpenses = thisMonthTx
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + (t.converted_amount ?? t.amount), 0);
    const totalIncome = thisMonthTx
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + (t.converted_amount ?? t.amount), 0);

    // Top categories by spend this month
    const catSpend: Record<string, number> = {};
    thisMonthTx
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const cat = t.category || "Uncategorized";
        catSpend[cat] = (catSpend[cat] || 0) + (t.converted_amount ?? t.amount);
      });
    const topCategories = Object.entries(catSpend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amount]) => `${cat}: ${amount.toFixed(2)}`)
      .join(", ");

    // Compact transaction lines
    const txLines = txList
      .map(
        (t) =>
          `${t.date} | ${t.type} | ${t.amount} ${t.currency}${t.converted_amount ? ` (=${t.converted_amount} ${t.converted_currency})` : ""} | ${t.merchant} | ${t.category || "No budget"}`
      )
      .join("\n");

    const systemPrompt = `You are a helpful personal finance assistant for the app SupaSpend. You have access to the user's transaction data and should answer questions about their spending, budgets, and financial habits. Be concise, friendly, and insightful.

This month's summary:
- Total expenses: ${totalExpenses.toFixed(2)}
- Total income: ${totalIncome.toFixed(2)}
- Net: ${(totalIncome - totalExpenses).toFixed(2)}
- Top spending categories: ${topCategories || "None yet"}${budgetSummary}

Recent transactions (up to 200, newest first):
${txLines || "No transactions found."}

Guidelines:
- When discussing amounts, use the currency shown in the data
- If asked about budgets, compare spending against the budget limits listed above
- Be specific with numbers when answering questions
- If the data doesn't contain enough info to answer, say so honestly
- Keep responses concise — 2-3 sentences for simple questions, more for detailed analysis`;

    // Call OpenAI with streaming
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      stream: true,
      max_tokens: 1000,
    });

    // Stream response back using ReadableStream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}

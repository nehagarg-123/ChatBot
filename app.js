import readline from 'node:readline/promises'
import dotenv from "dotenv";
import Groq from "groq-sdk";
import { tavily } from "@tavily/core";

dotenv.config();

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {

    const rl=readline.createInterface({input:process.stdin, output:process.stdout});

  const messages = [
    {
      role: "system",
      content: `
You are a helpful assistant.
If recent information is required, call the function "websearch"
with JSON: { "query": "<search text>" }.
 current date and  time :${new Date().toUTCString}
`
    },
    {
      role: "user",
      content: ""
    }
  ];
  while(true){

    const question=await rl.question('you : ')
    if(question=='bye') break;
    messages.push({
        role:'user',
        content: question,
    });
    while (true) {
    // 🔹 Call model
    
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: "websearch",
            description: "Search latest information from web",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string" }
              },
              required: ["query"]
            }
          }
        }
      ],
      tool_choice: "auto"
    });

    const assistantMessage = response.choices[0].message;
    messages.push(assistantMessage);

    // 🔹 If NO tool call → final answer
    if (!assistantMessage.tool_calls) {
      console.log("Assistant:", assistantMessage.content);
      break;
    }

    // 🔹 Execute tool(s)
    for (const tool of assistantMessage.tool_calls) {
      if (tool.function.name === "websearch") {
        const args = JSON.parse(tool.function.arguments);
        const result = await websearch(args);

        messages.push({
          role: "tool",
          tool_call_id: tool.id,
          content: JSON.stringify(result)
        });
      }
    }
    // loop continues → model sees tool result next iteration
  }
  
}
rl.close();

}

async function websearch({ query }) {
  console.log("🔍 Web search:", query);
  const response = await tvly.search(query);
  return response.results.map(r => r.content);
}

main();

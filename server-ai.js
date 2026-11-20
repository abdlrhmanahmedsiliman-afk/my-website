// server-ai.js - Multi-provider AI agent proxy (Groq, NVIDIA, Gemini, Cloudflare, OpenRouter)
const { GoogleGenAI, Type, ThinkingLevel } = require('@google/genai');

const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_client',
      description: 'Add a new client/customer to Kashf.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Client full name' },
          phone: { type: 'string', description: 'Client phone number (optional)' },
          whatsapp: { type: 'string', description: 'Client WhatsApp number (optional)' },
          email: { type: 'string', description: 'Client email address (optional)' },
          company: { type: 'string', description: 'Client company name (optional)' },
          address: { type: 'string', description: 'Client address (optional)' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_client',
      description: 'Update an existing client in Kashf.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Existing client name to locate' },
          phone: { type: 'string', description: 'New phone number' },
          email: { type: 'string', description: 'New email address' },
          company: { type: 'string', description: 'New company name' },
          address: { type: 'string', description: 'New address' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_client',
      description: 'Delete an existing client by name.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Client name to delete' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_expense',
      description: 'Record a new business expense in Kashf.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'Expense amount' },
          category: {
            type: 'string',
            enum: ['rent', 'transport', 'tools', 'internet', 'marketing', 'salaries', 'taxes', 'other'],
            description: 'Expense category'
          },
          vendor: { type: 'string', description: 'Vendor or expense title' },
          note: { type: 'string', description: 'Optional note' },
          date: { type: 'string', description: 'YYYY-MM-DD date (defaults to today)' },
          paymentMethod: {
            type: 'string',
            enum: ['cash', 'bank', 'vodafone', 'instapay', 'card', 'other']
          }
        },
        required: ['amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_product',
      description: 'Add a new product to inventory/products.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Product name' },
          salePrice: { type: 'number', description: 'Selling price per unit' },
          purchaseCost: { type: 'number', description: 'Purchase cost per unit' },
          stock: { type: 'number', description: 'Initial stock quantity in pieces' },
          barcode: { type: 'string', description: 'Optional barcode' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_invoice',
      description: 'Create a new invoice for a client with line items.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string', description: 'Client name (matched or created automatically)' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                qty: { type: 'number' },
                price: { type: 'number' }
              },
              required: ['description', 'qty', 'price']
            }
          },
          markSent: { type: 'boolean', description: 'Whether to mark the invoice as sent instead of draft' }
        },
        required: ['items']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_payment',
      description: 'Record a payment on an invoice.',
      parameters: {
        type: 'object',
        properties: {
          invoiceNumber: { type: 'string', description: 'Invoice number like INV-2026-0001' },
          amount: { type: 'number', description: 'Payment amount' },
          method: { type: 'string', enum: ['cash', 'bank', 'vodafone', 'instapay', 'card', 'other'] }
        },
        required: ['amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_quote',
      description: 'Create a new price quote for a client.',
      parameters: {
        type: 'object',
        properties: {
          clientName: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                qty: { type: 'number' },
                price: { type: 'number' }
              },
              required: ['description', 'qty', 'price']
            }
          }
        },
        required: ['items']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'convert_quote',
      description: 'Convert an existing quote into an invoice.',
      parameters: {
        type: 'object',
        properties: {
          quoteNumber: { type: 'string', description: 'Quote number like QUO-2026-0001' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_stocktake',
      description: 'Open the stocktake & audit report page and return live stocktake metrics.',
      parameters: {
        type: 'object',
        properties: {
          start: { type: 'string', description: 'Optional start date YYYY-MM-DD' },
          end: { type: 'string', description: 'Optional end date YYYY-MM-DD' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'open_report',
      description: 'Open the financial P&L reports page and return live company financial report data.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['thisMonth', 'last3Months', 'thisYear', 'allTime'],
            description: 'Report time period'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'navigate_page',
      description: 'Navigate the Kashf app to a specific screen.',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            enum: [
              'dashboard', 'invoices', 'quotes', 'clients', 'expenses',
              'inventory', 'employees', 'advisor', 'reports', 'settings',
              'pos', 'products', 'budget', 'analysis', 'stocktake'
            ]
          }
        },
        required: ['page']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_company_summary',
      description: 'Read fresh full company metrics, invoices, expenses, products, clients, and employees from the app.',
      parameters: {
        type: 'object',
        properties: {
          scope: { type: 'string', description: 'Optional scope e.g. all' }
        }
      }
    }
  }
];

function resolveCloudflareAccountId() {
  const candidates = [
    process.env.CLOUDFLARE_AI_ACCOUNT_ID,
    process.env.CLOUDFLARE_ACCOUNT_ID
  ];
  for (const val of candidates) {
    const clean = String(val || '').trim();
    if (/^[a-f0-9]{32}$/i.test(clean)) return clean;
  }
  return '';
}

function getProviderDefinitions() {
  const rawOrModel = (process.env.OPENROUTER_MODEL || 'openrouter/free').trim();
  const openRouterModel = (!rawOrModel || rawOrModel.toLowerCase() === 'free') ? 'openrouter/free' : rawOrModel;
  const cfAccountId = resolveCloudflareAccountId();

  return [
    {
      id: 'groq',
      rank: 1,
      type: 'openai',
      labelAr: 'gpt-oss-120b (Groq - الأسرع)',
      labelEn: 'gpt-oss-120b (Groq - Fastest)',
      providerName: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: (process.env.GROQ_MODEL || 'openai/gpt-oss-120b').trim(),
      envVar: 'GROQ_API_KEY',
      freeNoKey: false
    },
    {
      id: 'cloudflare',
      rank: 2,
      type: 'openai',
      labelAr: 'gpt-oss-120b (Cloudflare Workers AI)',
      labelEn: 'gpt-oss-120b (Cloudflare Workers AI)',
      providerName: 'Cloudflare Workers AI',
      baseUrl: cfAccountId ? `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/v1` : '',
      model: (process.env.CLOUDFLARE_MODEL || '@cf/openai/gpt-oss-120b').trim(),
      envVar: 'CLOUDFLARE_AI_ACCOUNT_ID',
      freeNoKey: false
    },
    {
      id: 'nvidia',
      rank: 3,
      type: 'openai',
      labelAr: 'Nemotron 3 Ultra 550B (NVIDIA)',
      labelEn: 'Nemotron 3 Ultra 550B (NVIDIA)',
      providerName: 'NVIDIA NIM',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: (process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b').trim(),
      envVar: 'NVIDIA_API_KEY',
      freeNoKey: false
    },
    {
      id: 'gemini',
      rank: 4,
      type: 'gemini',
      labelAr: 'Gemini Flash (Google)',
      labelEn: 'Gemini Flash (Google)',
      providerName: 'Google AI Studio',
      model: 'gemini-4-hydrogen',
      envVar: 'CUSTOM_GEMINI_API_KEY / GEMINI_API_KEY',
      freeNoKey: false
    },
    {
      id: 'openrouter',
      rank: 5,
      type: 'openai',
      labelAr: 'OpenRouter Free',
      labelEn: 'OpenRouter Free',
      providerName: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: openRouterModel,
      envVar: 'OPENROUTER_API_KEY',
      freeNoKey: false
    }
  ];
}

function getApiKey(def) {
  if (def.id === 'gemini') {
    return String(process.env.CUSTOM_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
  }
  if (def.id === 'cloudflare') {
    const accountId = resolveCloudflareAccountId();
    const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
    return (accountId && token) ? token : '';
  }
  return String(process.env[def.envVar] || '').trim();
}

function getProvidersStatus() {
  const defs = getProviderDefinitions();
  const providers = defs.map(d => {
    const hasKey = Boolean(getApiKey(d));
    return {
      id: d.id,
      rank: d.rank,
      labelAr: d.labelAr,
      labelEn: d.labelEn,
      providerName: d.providerName,
      model: d.model,
      envVar: d.envVar,
      configured: hasKey || Boolean(d.freeNoKey),
      hasKey,
      freeNoKey: Boolean(d.freeNoKey)
    };
  });
  const keyed = providers.filter(p => p.hasKey);
  const ready = providers.filter(p => p.configured);
  return {
    configured: ready.length > 0,
    configuredCount: keyed.length,
    readyCount: ready.length,
    defaultProvider: keyed[0]?.id || ready[0]?.id || 'groq',
    providers
  };
}

function buildSystemPrompt(snapshot, lang) {
  return [
    'You are the intelligent AI agent inside Kashf (كشف), a business invoicing, inventory, expense, payroll, and accounting app.',
    `Respond concisely and clearly in ${lang === 'en' ? 'English' : 'Egyptian/Modern Arabic'} using the company's actual currency and real figures from the live snapshot below.`,
    'You can both answer questions accurately from the snapshot AND execute real actions inside the app by calling the provided tools (add_client, update_client, delete_client, add_expense, add_product, create_invoice, add_payment, create_quote, convert_quote, run_stocktake, open_report, navigate_page, get_company_summary).',
    'When the user asks to add/update/delete a client, record an expense, create an invoice or quote, record a payment, run stocktake (اعمل لي جرد), or open/tell a report, ALWAYS call the appropriate tool(s) first and report back only after seeing tool results.',
    'Never invent numbers or claim an action succeeded unless the tool returned success: true.',
    `Live company snapshot (JSON):\n${JSON.stringify(snapshot || {})}`
  ].join('\n\n');
}

function toGeminiType(t) {
  switch (String(t || '').toLowerCase()) {
    case 'number': return Type.NUMBER;
    case 'integer': return Type.INTEGER;
    case 'boolean': return Type.BOOLEAN;
    case 'array': return Type.ARRAY;
    case 'object': return Type.OBJECT;
    default: return Type.STRING;
  }
}

function convertSchemaToGemini(schema) {
  if (!schema || typeof schema !== 'object') return undefined;
  const out = { type: toGeminiType(schema.type) };
  if (schema.description) out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = schema.enum;
  if (Array.isArray(schema.required)) out.required = schema.required;
  if (schema.properties && typeof schema.properties === 'object') {
    out.properties = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      out.properties[k] = convertSchemaToGemini(v);
    }
  }
  if (schema.items) out.items = convertSchemaToGemini(schema.items);
  return out;
}

const GEMINI_DECLARATIONS = AGENT_TOOLS.map(t => ({
  name: t.function.name,
  description: t.function.description,
  parameters: convertSchemaToGemini(t.function.parameters)
}));

async function callGemini(def, messages, systemPrompt) {
  const apiKey = getApiKey(def);
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });

  const contents = [];
  const toolIdToName = new Map();

  for (const m of messages.slice(-16)) {
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: String(m.content || '') }] });
    } else if (m.role === 'assistant') {
      if (Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          if (tc?.id && tc?.function?.name) toolIdToName.set(tc.id, tc.function.name);
        }
      }
      if (m._geminiContent) {
        contents.push(m._geminiContent);
      } else {
        const parts = [];
        if (m.content) parts.push({ text: String(m.content) });
        if (Array.isArray(m.tool_calls)) {
          for (const tc of m.tool_calls) {
            let args = {};
            try { args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}; } catch (e) {}
            parts.push({ functionCall: { id: tc.id, name: tc.function?.name, args } });
          }
        }
        if (parts.length) contents.push({ role: 'model', parts });
      }
    } else if (m.role === 'tool') {
      let respObj = {};
      try { respObj = JSON.parse(m.content || '{}'); } catch (e) { respObj = { result: m.content }; }
      const fnName = m.name || toolIdToName.get(m.tool_call_id) || 'tool_result';
      const fnRespPart = {
        functionResponse: {
          id: m.tool_call_id,
          name: fnName,
          response: respObj
        }
      };
      const prev = contents[contents.length - 1];
      if (prev && prev.role === 'user' && Array.isArray(prev.parts) && prev.parts.some(p => p.functionResponse)) {
        prev.parts.push(fnRespPart);
      } else {
        contents.push({ role: 'user', parts: [fnRespPart] });
      }
    }
  }

  const response = await ai.models.generateContent({
    model: def.model,
    contents,
    config: {
      systemInstruction: systemPrompt,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      tools: [{ functionDeclarations: GEMINI_DECLARATIONS }]
    }
  });

  const functionCalls = Array.isArray(response.functionCalls) ? response.functionCalls : [];
  const toolCalls = functionCalls.map((fc, idx) => ({
    id: fc.id || `gem_tc_${Date.now()}_${idx}`,
    type: 'function',
    function: {
      name: fc.name,
      arguments: JSON.stringify(fc.args || {})
    }
  }));

  return {
    provider: def.id,
    model: def.model,
    message: {
      role: 'assistant',
      content: response.text || '',
      tool_calls: toolCalls,
      _geminiContent: response.candidates?.[0]?.content || null
    }
  };
}

async function callOpenAICompatible(def, messages, systemPrompt) {
  const apiKey = getApiKey(def);
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (def.id === 'openrouter') {
    headers['HTTP-Referer'] = 'https://kashf.app';
    headers['X-Title'] = 'Kashf';
  }

  const cleanMsgs = messages.slice(-16).map(m => {
    const copy = { role: m.role, content: m.content ?? '' };
    if (m.tool_calls) copy.tool_calls = m.tool_calls;
    if (m.tool_call_id) copy.tool_call_id = m.tool_call_id;
    return copy;
  });

  const basePayload = {
    model: def.model,
    messages: [{ role: 'system', content: systemPrompt }, ...cleanMsgs],
    max_tokens: 2048,
    temperature: 0.2
  };

  const fetchWithTimeout = async (bodyObj) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const r = await fetch(`${def.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(bodyObj)
      });
      const d = await r.json().catch(() => null);
      return { r, d };
    } finally {
      clearTimeout(timer);
    }
  };

  let { r: res, d: data } = await fetchWithTimeout({ ...basePayload, tools: AGENT_TOOLS, tool_choice: 'auto' });

  // Fallback for endpoints/models that reject tools parameter with 400/422
  if (!res.ok && (res.status === 400 || res.status === 422)) {
    const errTxt = String(data?.error?.message || data?.detail || '').toLowerCase();
    if (/tool|function|choice/.test(errTxt) || !cleanMsgs.some(m => m.role === 'tool')) {
      ({ r: res, d: data } = await fetchWithTimeout(basePayload));
    }
  }

  if (!res.ok) {
    const err = new Error(data?.error?.message || data?.message || data?.detail || `${def.providerName} error (${res.status})`);
    err.status = res.status;
    throw err;
  }

  const choice = data?.choices?.[0]?.message || {};
  return {
    provider: def.id,
    model: data?.model || def.model,
    message: {
      role: 'assistant',
      content: choice.content || '',
      tool_calls: Array.isArray(choice.tool_calls) ? choice.tool_calls : []
    }
  };
}

async function runAgentTurn({ provider = 'auto', messages = [], snapshot = {}, lang = 'ar' }) {
  const defs = getProviderDefinitions();
  const systemPrompt = buildSystemPrompt(snapshot, lang);

  let candidates;
  if (provider && provider !== 'auto') {
    const exact = defs.find(d => d.id === provider);
    if (!exact) {
      return { ok: false, status: 400, configured: false, error: `Unknown provider: ${provider}` };
    }
    if (!getApiKey(exact) && !exact.freeNoKey) {
      return {
        ok: false,
        status: 503,
        configured: false,
        provider: exact.id,
        envVar: exact.envVar,
        error: `${exact.envVar} is not configured on the server.`
      };
    }
    candidates = [exact];
  } else {
    const withKeys = defs.filter(d => Boolean(getApiKey(d)));
    const anonOvh = defs.filter(d => d.freeNoKey && !getApiKey(d));
    candidates = [...withKeys, ...anonOvh];
  }

  let lastErr = null;
  const isAuto = !provider || provider === 'auto';
  for (const def of candidates) {
    try {
      const task = def.type === 'gemini'
        ? callGemini(def, messages, systemPrompt)
        : callOpenAICompatible(def, messages, systemPrompt);
      const result = isAuto
        ? await Promise.race([
            task,
            new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(`${def.providerName} timed out`), { status: 504 })), 20000))
          ])
        : await task;
      return { ok: true, configured: true, ...result };
    } catch (err) {
      lastErr = {
        status: err?.status || 502,
        provider: def.id,
        error: err?.message || `Failed calling ${def.providerName}`
      };
      if (!isAuto) break;
    }
  }

  return {
    ok: false,
    configured: true,
    status: lastErr?.status || 502,
    provider: lastErr?.provider || provider,
    error: lastErr?.error || 'No AI provider responded.'
  };
}

module.exports = {
  getProvidersStatus,
  runAgentTurn
};

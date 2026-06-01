const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');

const SYSTEM_PROMPT = `
You are a constraint parsing assistant for an English Center Scheduling system (LotusTime).
Your job is to convert natural language (Vietnamese) constraints into a precise JSON structure.
If the API KEY is dummy_key, you might fail but that's handled gracefully.

Expected JSON output format:
{
  "constraint_type": "avoid_overlap" | "unavailable" | "morning_only" | "afternoon_only" | "same_session" | "max_sessions" | "room_assignment" | "unknown",
  "subject_person": "short_name of the person, class code, or teacher type (e.g., 'Giáo viên nước ngoài' or 'Mikey')",
  "details": {
    "day_of_week": [number] (2 to 8 for Monday to Sunday),
    "time_period": "morning" | "afternoon" | "evening",
    "max_count": number (if applicable),
    "room_name": "string (e.g., 'Room 2' or 'Room 1') if the constraint specifies a classroom"
  },
  "priority": number (1 to 10, default is 5. High priority = 8-10, low = 1-3)
}

Only return the JSON. Do not include markdown code blocks.
`;

function ruleBasedParse(rawText) {
  const text = rawText.toLowerCase();
  const result = {
    constraint_type: 'unknown',
    subject_person: '',
    details: {},
    priority: 5
  };

  // 1. Detect Room Assignment
  const roomMatch = text.match(/(room\s*\d+|phòng\s*\d+)/i);
  if (roomMatch) {
    result.constraint_type = 'room_assignment';
    const numMatch = roomMatch[0].match(/\d+/);
    const num = numMatch ? numMatch[0] : '1';
    result.details.room_name = `Room ${num}`;
  }

  // 2. Detect Same Session
  if (text.includes('chung buổi') || text.includes('cùng buổi') || text.includes('chung ca') || text.includes('cùng ca')) {
    result.constraint_type = 'same_session';
  }

  // 3. Detect Morning/Afternoon/Evening
  if (text.includes('sáng')) {
    result.constraint_type = 'morning_only';
  } else if (text.includes('chiều')) {
    result.constraint_type = 'afternoon_only';
  } else if (text.includes('tối')) {
    result.details.time_period = 'evening';
  }

  // 4. Detect Subject/Person
  const classMatches = text.match(/[lL]\d+/g);
  if (classMatches) {
    result.subject_person = classMatches.map(c => c.toUpperCase()).join(', ');
  } else if (text.includes('giáo viên nước ngoài') || text.includes('gv nước ngoài') || text.includes('gvnn')) {
    result.subject_person = 'Giáo viên nước ngoài';
  } else {
    const words = rawText.split(/\s+/);
    const jas = words.find(w => {
      const low = w.toLowerCase().replace(/[^a-z]/g, '');
      return low === 'jasmine' || low === 'mark' || low === 'mikey';
    });
    if (jas) {
      result.subject_person = jas.replace(/[^a-zA-Z]/g, '');
    }
  }

  // 5. Detect priority
  if (text.includes('bắt buộc') || text.includes('luôn') || text.includes('phải')) {
    result.priority = 9;
  }

  return result;
}

exports.parseConstraint = async (rawText) => {
  const fallback = ruleBasedParse(rawText);
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy_key') {
    return fallback;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: `Raw Text: "${rawText}"` }
    ]);
    const response = await result.response;
    const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(text);
    if (parsed.constraint_type === 'unknown' && fallback.constraint_type !== 'unknown') {
      return { ...parsed, ...fallback };
    }
    return parsed;
  } catch (err) {
    console.error("Gemini Parsing Error:", err);
    return fallback;
  }
};

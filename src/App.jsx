import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, ArrowLeft, Send, Package, MapPin, Clock, CheckCircle, Sparkles, User, Bot, AlertTriangle } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, query } from 'firebase/firestore';

/**
 * FreeCycle AI Assistant (Hybrid: Works in Sandbox & Production)
 */

// --- 1. ROBUST CONFIGURATION SETUP ---

const isSandbox = typeof __firebase_config !== 'undefined';

// GEMINI API KEY CONFIGURATION
// We use a try-catch block to safely read the Environment Variable.
// This prevents the "import.meta" warning from breaking the sandbox.
let API_KEY = "";
try {
  // In Vercel (Vite), this will read your secret key.
  // In Sandbox, this block gracefully fails or returns undefined.
  if (import.meta && import.meta.env && import.meta.env.VITE_GEMINI_KEY) {
    API_KEY = import.meta.env.VITE_GEMINI_KEY.trim();
  }
} catch (e) {
  // Ignore environment read errors in sandbox
  console.log("Running in Sandbox mode (No Env Vars)");
}

// DEBUGGING: Print partial key to Console (Safe version)
if (API_KEY) {
    console.log("🔑 DEBUG: Loaded API Key starting with:", API_KEY.substring(0, 5) + "...");
} else {
    console.log("🔑 DEBUG: No API Key loaded (Normal for Sandbox Preview)");
}

// FIXED: Using the specific model version from your available list
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025"; 

const getFirebaseConfig = () => {
  let config = null;
  if (isSandbox) {
    try {
      config = JSON.parse(__firebase_config);
    } catch (err) {
      console.warn("Sandbox config available but failed to parse:", err);
    }
  }
  if (!config) {
    config = {
      // PASTE YOUR REAL FIREBASE CONFIG HERE FOR DEPLOYMENT
        apiKey: "AIzaSyDMikDWDj9kvVPSETToK5jYdmrdjqGXnts",
        authDomain: "my-freecycle-app.firebaseapp.com",
        projectId: "my-freecycle-app",
        storageBucket: "my-freecycle-app.firebasestorage.app",
        messagingSenderId: "807602473704",
        appId: "1:807602473704:web:a4fe6260a57bc7c10f175d",
        measurementId: "G-EQJLHWDNJC"
    };
  }
  return config;
};

const firebaseConfig = getFirebaseConfig();

// --- 2. INITIALIZE FIREBASE ---
let app, auth, db;

try {
  if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY_HERE") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } else if (isSandbox && firebaseConfig) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } else {
    console.error("Firebase Config is missing or invalid.");
  }
} catch (error) {
  console.error("Error initializing Firebase:", error);
}

const getListingsRef = (databaseInstance) => {
  if (!databaseInstance) return null;
  
  if (isSandbox) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const safeAppId = appId.replace(/\//g, '_');
    return collection(databaseInstance, 'artifacts', safeAppId, 'public', 'data', 'listings');
  } else {
    return collection(databaseInstance, 'listings');
  }
};

// --- Mock Data ---
const DEMO_LISTINGS = [
  {
    title: "Mid-Century Modern Armchair",
    description: "Vintage teal armchair from the 60s. Structure is solid wood (teak). The upholstery is original but has some cat scratches on the left arm.",
    condition: "Fair",
    location: "Queen West, Toronto",
    dimensions: "30\" W x 32\" D x 35\" H",
    availability: "Weeknights after 6pm",
    category: "Furniture",
    imageColor: "bg-teal-600"
  },
  {
    title: "Box of Sci-Fi Novels",
    description: "About 20 paperback science fiction books. Isaac Asimov, Frank Herbert, etc. Read once, good condition.",
    condition: "Good",
    location: "Annex, Toronto",
    dimensions: "Standard Box",
    availability: "Porch pickup anytime",
    category: "Books",
    imageColor: "bg-indigo-600"
  }
];

// --- Components ---

const ConfigErrorBanner = () => (
  <div className="bg-amber-50 border-b border-amber-200 p-4 flex items-start gap-3 text-amber-800 animate-fade-in">
    <AlertTriangle className="shrink-0 mt-0.5" size={20} />
    <div>
      <h3 className="font-bold text-sm">Configuration Required</h3>
      <p className="text-xs mt-1">
        Firebase is not connected. If you are running this locally, open <code>src/App.jsx</code> and paste your <code>firebaseConfig</code> keys.
      </p>
    </div>
  </div>
);

const Header = ({ setView, view, user }) => (
  <header className="bg-emerald-600 text-white shadow-md sticky top-0 z-50">
    <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
      <div 
        className="flex items-center gap-2 cursor-pointer" 
        onClick={() => setView('landing')}
      >
        <Sparkles size={24} className="text-yellow-300" />
        <h1 className="text-xl font-bold tracking-tight">GiveFree<span className="font-light text-emerald-100">AI</span></h1>
      </div>
      <div className="flex items-center gap-4">
        {view !== 'landing' && (
            <button 
            onClick={() => setView('landing')}
            className="text-sm font-medium hover:text-emerald-100 transition-colors hidden sm:block"
            >
            Switch Mode
            </button>
        )}
        {user && (
             <div className="text-xs bg-emerald-700 px-2 py-1 rounded-full text-emerald-100 flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                Connected
             </div>
        )}
      </div>
    </div>
  </header>
);

const LandingPage = ({ setView }) => (
  <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center animate-fade-in">
    <div className="bg-emerald-100 p-4 rounded-full mb-6">
      <Package size={48} className="text-emerald-600" />
    </div>
    <h2 className="text-4xl font-extrabold text-gray-800 mb-4">Rehome your stuff, hassle-free.</h2>
    <p className="text-gray-600 max-w-md mb-10 text-lg">
      Our AI assistant handles the questions and coordination so you don't have to.
    </p>
    
    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
      <button 
        onClick={() => setView('browse')}
        className="flex-1 bg-white border-2 border-emerald-600 text-emerald-700 py-4 rounded-xl font-bold text-lg hover:bg-emerald-50 transition-all shadow-sm flex items-center justify-center gap-2"
      >
        <Search size={20} />
        Find Items
      </button>
      <button 
        onClick={() => setView('create')}
        className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
      >
        <Plus size={20} />
        Give Away
      </button>
    </div>
  </div>
);

const CreateListing = ({ setView, user }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    condition: 'Good',
    location: '',
    dimensions: '',
    availability: '',
    category: 'Misc'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !db) return;
    setIsSubmitting(true);
    
    try {
        const colors = ['bg-teal-600', 'bg-indigo-600', 'bg-rose-600', 'bg-amber-600', 'bg-emerald-600', 'bg-blue-600', 'bg-purple-600'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        const ref = getListingsRef(db);
        if (!ref) throw new Error("Database not initialized");

        await addDoc(ref, {
            ...formData,
            imageColor: randomColor,
            ownerId: user.uid,
            createdAt: serverTimestamp()
        });
        
        setView('browse');
    } catch (error) {
        console.error("Error adding document: ", error);
        alert("Failed to create listing. Check console for details.");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 animate-slide-up">
      <button onClick={() => setView('landing')} className="text-gray-500 hover:text-gray-800 mb-6 flex items-center gap-1">
        <ArrowLeft size={16} /> Back
      </button>
      
      <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Plus className="text-emerald-600" /> List an Item
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Title</label>
            <input 
              required 
              name="title"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" 
              placeholder="e.g. Wooden Coffee Table"
              value={formData.title}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea 
              required 
              name="description"
              rows="4"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" 
              placeholder="Describe defects, history, features."
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          {/* Simplified inputs for brevity in this safe version */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
              <select 
                name="condition"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.condition}
                onChange={handleChange}
              >
                <option>New</option>
                <option>Like New</option>
                <option>Good</option>
                <option>Fair</option>
                <option>Poor / For Parts</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select 
                name="category"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                value={formData.category}
                onChange={handleChange}
              >
                <option>Furniture</option>
                <option>Electronics</option>
                <option>Books</option>
                <option>Clothing</option>
                <option>Kitchen</option>
                <option>Misc</option>
              </select>
            </div>
          </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">General Location</label>
              <input 
                required 
                name="location"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" 
                placeholder="e.g. Downtown"
                value={formData.location}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dimensions</label>
              <input 
                name="dimensions"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" 
                placeholder="e.g. 4ft x 2ft"
                value={formData.dimensions}
                onChange={handleChange}
              />
            </div>
          </div>

           <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
            <input 
              required 
              name="availability"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" 
              placeholder="e.g. Weekends only"
              value={formData.availability}
              onChange={handleChange}
            />
          </div>

          <button 
            disabled={isSubmitting || !user}
            type="submit" 
            className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {isSubmitting ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            ) : (
              "Post Free Item"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

const ChatBubble = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-gray-200' : 'bg-emerald-100'}`}>
          {isUser ? <User size={16} className="text-gray-600" /> : <Bot size={16} className="text-emerald-600" />}
        </div>
        <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isUser 
            ? 'bg-gray-800 text-white rounded-tr-none' 
            : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
        }`}>
          {message.text}
        </div>
      </div>
    </div>
  );
};

const ItemDetail = ({ item, onBack }) => {
  const [messages, setMessages] = useState([
    { role: 'model', text: `Hi! I'm the AI assistant for this ${item.title}. Ask me anything about the condition, dimensions, or pickup details!` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const generateResponse = async (userQuery) => {
    setIsLoading(true);
    
    // System prompt construction
    const systemPrompt = `
      You are a friendly and helpful AI assistant helping to give away a free item.
      
      ITEM DETAILS:
      Title: ${item.title}
      Description: ${item.description}
      Condition: ${item.condition}
      Dimensions: ${item.dimensions}
      Pickup Location: ${item.location}
      Availability: ${item.availability}
      
      YOUR GOAL:
      Answer the potential taker's questions based strictly on the information above.
      If the answer is explicitly in the details, give it clearly.
      If the user asks if it's still available, assume YES.
      If the user asks something not covered in the details (e.g., "Is it heavy?" if weight isn't listed, or "Can you deliver?" if not specified), apologize and say you don't know but can ask the owner.
      Be concise, polite, and encouraging.
      If the user says "I want it" or expresses strong interest, instruct them to click the "Claim / Message Owner" button below to finalize the pickup.
    `;

    if (!isSandbox && (!API_KEY || API_KEY.length < 10)) {
      setMessages(prev => [...prev, { role: 'model', text: "Configuration Error: The Gemini API Key is missing in src/App.jsx. Please add it to your code and redeploy." }]);
      setIsLoading(false);
      return;
    }

    try {
      const apiKey = isSandbox ? "" : API_KEY;
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
          }),
        }
      );

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't process that request right now.";
      setMessages(prev => [...prev, { role: 'model', text: aiResponse }]);
    } catch (error) {
      console.error("API Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: `Debug Error: ${error.message || "Unknown Error"}. Check browser console for details.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    generateResponse(input);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row bg-gray-50">
      {/* Item Details Panel */}
      <div className="w-full md:w-1/2 p-4 overflow-y-auto border-r border-gray-200 bg-white">
        <button onClick={onBack} className="mb-4 text-gray-500 hover:text-gray-800 flex items-center gap-1 font-medium">
          <ArrowLeft size={18} /> Back to List
        </button>
        
        <div className={`w-full h-64 ${item.imageColor || 'bg-gray-400'} rounded-xl mb-6 flex items-center justify-center shadow-inner`}>
          <Package size={64} className="text-white opacity-50" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">{item.title}</h1>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium border border-gray-200">
            {item.condition}
          </span>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium border border-emerald-100">
            {item.category}
          </span>
        </div>
        
        {/* Content stripped for brevity but functionality remains */}
        <div className="space-y-4 text-gray-700">
          <p className="leading-relaxed">{item.description}</p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100">
            <button className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2">
                <CheckCircle size={20} />
                Claim / Message Owner
            </button>
        </div>
      </div>

      {/* AI Chat Interface */}
      <div className="w-full md:w-1/2 flex flex-col h-[50vh] md:h-auto bg-gray-50">
        <div className="p-4 bg-white border-b border-gray-200 shadow-sm flex justify-between items-center">
            <div>
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Bot className="text-emerald-600" size={20} /> 
                Ask the Assistant
                </h3>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2" ref={scrollRef}>
          {messages.map((msg, idx) => (
            <ChatBubble key={idx} message={msg} />
          ))}
          {isLoading && <div className="text-sm text-gray-400 italic p-2">Thinking...</div>}
        </div>

        <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-200 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about dimensions, condition, etc..."
            className="flex-1 bg-gray-100 text-gray-900 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
          />
          <button type="submit" disabled={isLoading || !input.trim()} className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700">
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default App;
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { GoogleGenAI } from "@google/genai";
import { Star, X, ZoomIn, ZoomOut, Maximize2, ExternalLink, Info, Image as ImageIcon, Sparkles, LogOut, User, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const MET_BASE = "https://collectionapi.metmuseum.org/public/collection/v1";
const API_BASE = "/api"; 

export default function App() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [allIds, setAllIds] = useState<number[]>([]); 
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready to explore the Met");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  const [user, setUser] = useState<{email: string, token: string} | null>(null); 
  const [authVisible, setAuthVisible] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [creds, setCreds] = useState({ email: "", password: "" });

  const [collections, setCollections] = useState<Record<string, any[]>>({ "My First Exhibition": [] });
  const [activeCollection, setActiveCollection] = useState("My First Exhibition");
  const [viewMode, setViewMode] = useState<"search" | "curation">("search"); 
  const [newCollectionName, setNewCollectionName] = useState("");

  const tok = useRef(0);
  const observer = useRef<IntersectionObserver | null>(null);
  const PAGE_SIZE = 12; 
  const GOLD="#c9a84c", BG="#0e0c0a", CARD="#161210", TEXT="#e8ddd4";

  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const isFetching = useRef(false);

  // Initial Load
  useEffect(() => {
    const savedToken = localStorage.getItem("met_vault_token");
    const savedEmail = localStorage.getItem("met_vault_email");
    if (savedToken && savedEmail) {
      setUser({ token: savedToken, email: savedEmail });
      fetchCollections(savedToken);
    } else {
      const saved = localStorage.getItem("met_vault_v8");
      if (saved) {
        const parsed = JSON.parse(saved);
        setCollections(parsed);
        const firstKey = Object.keys(parsed)[0];
        if (firstKey) setActiveCollection(firstKey);
      }
    }
  }, []);

  const fetchCollections = async (token: string) => {
    isFetching.current = true;
    try {
      const res = await fetch(`${API_BASE}/collections`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (data.collections && Object.keys(data.collections).length > 0) {
        setCollections(data.collections);
        setActiveCollection(Object.keys(data.collections)[0]);
      }
    } catch (e) { 
      console.warn("Failed to fetch collections from cloud, using local storage"); 
    } finally {
      setTimeout(() => { isFetching.current = false; }, 500);
    }
  };

  // Sync effect
  useEffect(() => {
    localStorage.setItem("met_vault_v8", JSON.stringify(collections));
    if (user && !isFetching.current) syncToCloud();
  }, [collections, user]);

  const syncToCloud = async () => {
    if (!user) return;
    try {
      await fetch(`${API_BASE}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.token}` },
        body: JSON.stringify({ collections })
      });
    } catch (e) { console.warn("Cloud sync failed"); }
  };

  const handleAuth = async () => {
    setStatus("Authenticating...");
    try {
      const res = await fetch(`${API_BASE}/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds)
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("met_vault_token", data.token);
        localStorage.setItem("met_vault_email", data.email);
        setUser({ email: data.email, token: data.token });
        setAuthVisible(false);
        setStatus("Logged in successfully.");
        fetchCollections(data.token);
      } else { setStatus(data.error || "Auth failed"); }
    } catch (e) { setStatus("Server connection error."); }
  };

  const logout = () => {
    localStorage.removeItem("met_vault_token");
    localStorage.removeItem("met_vault_email");
    setUser(null);
    setStatus("Logged out.");
    setCollections({ "My First Exhibition": [] });
    setActiveCollection("My First Exhibition");
  };

  const createCollection = () => {
    if (!newCollectionName.trim()) return;
    if (collections[newCollectionName]) {
      setStatus("Exhibition name already exists.");
      return;
    }
    setCollections(prev => ({ ...prev, [newCollectionName]: [] }));
    setActiveCollection(newCollectionName);
    setNewCollectionName("");
    setStatus(`Created exhibition: ${newCollectionName}`);
  };

  const deleteCollection = (name: string) => {
    if (Object.keys(collections).length <= 1) {
      setStatus("Cannot delete the last exhibition.");
      return;
    }
    setCollections(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    if (activeCollection === name) {
      setActiveCollection(Object.keys(collections).find(k => k !== name) || "");
    }
    setStatus(`Deleted exhibition: ${name}`);
  };

  const validateImage = (url: string) => {
    if (!url) return Promise.resolve(false);
    return new Promise((r) => { 
        const i = new Image(); 
        i.onload = () => r(true); 
        i.onerror = () => r(false); 
        i.src = url; 
    });
  };

  const fetchBatch = useCallback(async (idsToFetch: number[], currentToken: number) => {
    if (idsToFetch.length === 0) return;
    setLoading(true);
    setStatus("Fetching details...");
    
    const batchResults: any[] = [];

    for (const id of idsToFetch) {
      if (currentToken !== tok.current) return;
      try {
        const r = await fetch(`${MET_BASE}/objects/${id}`);
        const obj = await r.json();
        const isAlive = await validateImage(obj.primaryImageSmall);
        
        batchResults.push({ 
            id, 
            title: obj.title || "Untitled", 
            artist: obj.artistDisplayName || "Unknown", 
            imageUrl: isAlive ? obj.primaryImageSmall : null, 
            fullSize: obj.primaryImage, 
            additionalImages: obj.additionalImages || [],
            metUrl: obj.objectURL, 
            accession: obj.accessionNumber, 
            dept: obj.department, 
            medium: obj.medium, 
            dimensions: obj.dimensions, 
            date: obj.objectDate,
            creditLine: obj.creditLine,
            culture: obj.culture,
            classification: obj.classification,
            galleryNumber: obj.galleryNumber,
            geography: [obj.city, obj.state, obj.county, obj.country, obj.region].filter(Boolean).join(", "),
            rights: obj.rightsAndReproduction,
            objectName: obj.objectName,
            repository: obj.repository,
            tags: obj.tags ? obj.tags.map((t: any) => t.term) : [],
            isRestricted: !isAlive 
        });
      } catch (e) { console.error(`Failed to fetch ID ${id}`); }
    }

    if (currentToken === tok.current) {
      setItems(prev => [...prev, ...batchResults]);
      setLoading(false);
      setStatus("Archive batch loaded.");
    }
  }, []);

  const runSearch = async () => {
    if (!query.trim()) return;
    setViewMode("search");
    const t = ++tok.current;
    setItems([]); 
    setAllIds([]);
    setLoading(true);
    setStatus(`Searching the MET...`);
    
    try {
      const r = await fetch(`${MET_BASE}/search?hasImages=true&q=${encodeURIComponent(query)}`);
      const data = await r.json();
      if (t !== tok.current) return;
      if (!data.objectIDs) { 
        setStatus(`No records found.`); 
        setLoading(false);
        return; 
      }
      setAllIds(data.objectIDs);
      fetchBatch(data.objectIDs.slice(0, PAGE_SIZE), t);
    } catch (e) { 
        setStatus("Connection error."); 
        setLoading(false);
    }
  };

  const lastItemRef = useCallback((node: HTMLDivElement) => {
    if (loading || viewMode !== "search") return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && allIds.length > items.length && !loading) {
        const nextBatch = allIds.slice(items.length, items.length + PAGE_SIZE);
        fetchBatch(nextBatch, tok.current);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, allIds, items.length, fetchBatch, viewMode]);

  const toggleSave = (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    setCollections(prev => {
      const currentList = prev[activeCollection] || [];
      const isSaved = currentList.some(i => i.id === item.id);
      const newList = isSaved 
        ? currentList.filter(i => i.id !== item.id) 
        : [...currentList, { ...item, curatorialLabel: "" }];
      return { ...prev, [activeCollection]: newList };
    });
  };

  const updateLabel = (itemId: number, newLabel: string) => {
    setCollections(prev => {
      const newList = (prev[activeCollection] || []).map(i => 
        i.id === itemId ? { ...i, curatorialLabel: newLabel } : i
      );
      return { ...prev, [activeCollection]: newList };
    });
  };

  const generateAiInsight = async (item: any) => {
    setAiLoading(true);
    try {
      const key = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      
      if (!key || key === "YOUR_GEMINI_API_KEY" || key.trim() === "") {
        setAiInsight("AI Curator unavailable: Missing API Key. If running locally, please add GEMINI_API_KEY to your .env file and restart the server.");
        setAiLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `As a senior museum curator, provide a 2-3 sentence scholarly insight about this artwork: "${item.title}" by ${item.artist}, ${item.date}. Focus on its historical significance, technique, or a hidden detail.`,
      });
      setAiInsight(response.text || "No insight available.");
    } catch (e) {
      console.error("Gemini Error:", e);
      setAiInsight("Curatorial connection interrupted. Please check your connection and API key.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleItemClick = (item: any) => {
    setSelectedItem(item);
    setAiInsight("");
    generateAiInsight(item);
  };

  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [zoomMode, setZoomMode] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });
  const [zoomImgPos, setZoomImgPos] = useState({ x: 0, y: 0 });
  const [generalZoom, setGeneralZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (selectedItem) {
      setActiveImage(selectedItem.fullSize || selectedItem.imageUrl);
    }
  }, [selectedItem]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.pageX - rect.left - window.scrollX;
    const mouseY = e.pageY - rect.top - window.scrollY;

    if (isDragging) {
      const dx = e.pageX - dragStart.x;
      const dy = e.pageY - dragStart.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) setHasMoved(true);
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.pageX, y: e.pageY });
    }

    // Calculate lens position in container percentages
    const xPct = (mouseX / rect.width) * 100;
    const yPct = (mouseY / rect.height) * 100;
    setZoomPos({ x: xPct, y: yPct });

    // Calculate what part of the image is actually under the cursor
    // accounting for pan and general zoom
    const imgX = ((mouseX - panOffset.x - rect.width / 2) / generalZoom) + rect.width / 2;
    const imgY = ((mouseY - panOffset.y - rect.height / 2) / generalZoom) + rect.height / 2;
    
    const imgXPct = (imgX / rect.width) * 100;
    const imgYPct = (imgY / rect.height) * 100;
    setZoomImgPos({ x: imgXPct, y: imgYPct });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({ x: e.pageX, y: e.pageY });
  };

  const handleMouseUp = () => {
    const wasDragging = isDragging && hasMoved;
    setIsDragging(false);
    
    if (!wasDragging) {
      setZoomMode(!zoomMode);
    }
    setHasMoved(false);
  };

  const displayItems = viewMode === "search" ? items : collections[activeCollection] || [];

  return (
    <div className="min-h-screen w-full text-[#e8ddd4] font-serif" style={{ background: BG }}>
      <header className="text-center py-10 px-5 relative">
        <div className="absolute top-5 right-5 flex gap-3">
          {user ? (
            <button 
              onClick={logout} 
              className="flex items-center gap-2 border border-[#c9a84c] text-[#c9a84c] px-4 py-1.5 rounded-sm text-[10px] tracking-widest hover:bg-[#c9a84c] hover:text-black transition-colors"
            >
              <LogOut size={12} /> LOGOUT ({user.email})
            </button>
          ) : (
            <button 
              onClick={() => setAuthVisible(true)} 
              className="flex items-center gap-2 bg-[#c9a84c] text-black px-4 py-1.5 rounded-sm text-[10px] font-bold tracking-widest hover:bg-[#b39540] transition-colors"
            >
              <User size={12} /> MEMBER SIGN-IN
            </button>
          )}
        </div>
        
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[#c9a84c] text-4xl md:text-5xl font-light tracking-[0.2em] mb-10"
        >
          🏛Met Museum Explorer🏛
        </motion.h1>

        <div className="flex justify-center gap-px max-w-2xl mx-auto border-b border-[#2d2520]">
          <button 
            className={`px-8 py-3 text-[11px] tracking-[0.2em] uppercase transition-all ${viewMode === 'search' ? 'bg-[#c9a84c] text-black font-bold' : 'text-[#5a4a3e] hover:text-[#e8ddd4]'}`}
            onClick={() => setViewMode("search")}
          >
            Archives
          </button>
          <button 
            className={`px-8 py-3 text-[11px] tracking-[0.2em] uppercase transition-all ${viewMode === 'curation' ? 'bg-[#c9a84c] text-black font-bold' : 'text-[#5a4a3e] hover:text-[#e8ddd4]'}`}
            onClick={() => setViewMode("curation")}
          >
            Your Exhibitions ({Object.keys(collections).length})
          </button>
        </div>
        
        <div className="text-[10px] text-[#6e5a4b] mt-5 font-mono tracking-widest uppercase">
          {status}
        </div>
      </header>

      <div className="max-w-5xl mx-auto mb-8 px-5">
        <div className="flex flex-wrap gap-3 items-center justify-center mb-5">
          <span className="text-[11px] text-[#5a4a3e] uppercase tracking-widest">Active Exhibition:</span>
          {Object.keys(collections).map(name => (
            <div key={name} className="flex items-center gap-1">
              <button 
                className={`px-4 py-1.5 border rounded-sm text-[11px] transition-all ${activeCollection === name ? 'border-[#c9a84c] text-[#c9a84c]' : 'border-[#2d2520] text-[#8b7667] hover:bg-[#1d1916]'}`}
                onClick={() => setActiveCollection(name)}
              >
                {name} ({collections[name].length})
              </button>
              {Object.keys(collections).length > 1 && (
                <button 
                  onClick={() => deleteCollection(name)} 
                  className="text-[#443830] hover:text-red-800 transition-colors px-1"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        
        <div className="flex justify-center gap-2">
          <input 
            value={newCollectionName} 
            onChange={e => setNewCollectionName(e.target.value)} 
            placeholder="New exhibition name..." 
            className="bg-black border border-[#2d2520] text-white px-3 py-2 text-xs outline-none focus:border-[#c9a84c] transition-colors w-48"
          />
          <button 
            onClick={createCollection} 
            className="bg-[#2d2520] text-[#c9a84c] px-4 py-2 text-[10px] tracking-widest hover:bg-[#3d332c] transition-colors flex items-center gap-2"
          >
            <Plus size={12} /> CREATE
          </button>
        </div>
      </div>

      {viewMode === "search" && (
        <div className="flex max-w-2xl mx-auto mb-12 border border-[#2d2520] p-1 bg-black/30 backdrop-blur-sm">
          <input 
            value={query} 
            onChange={e => setQuery(e.target.value)} 
            onKeyDown={e => e.key === "Enter" && runSearch()} 
            placeholder="Search by artist, period, or keyword..." 
            className="flex-1 px-5 py-4 bg-transparent text-white outline-none text-lg font-light"
          />
          <button 
            onClick={runSearch} 
            className="bg-[#c9a84c] text-black px-8 font-bold tracking-widest hover:bg-[#b39540] transition-colors"
          >
            SEARCH
          </button>
        </div>
      )}

      <main className="px-[4%] pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {displayItems.map((item, index) => {
            const isSaved = (collections[activeCollection] || []).some(i => i.id === item.id);
            return (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                key={`${item.id}-${index}`} 
                ref={viewMode === "search" && items.length === index + 1 ? lastItemRef : null} 
                onClick={() => handleItemClick(item)} 
                className="group relative bg-[#161210] border border-[#1d1916] cursor-pointer hover:border-[#c9a84c] transition-all duration-500 hover:-translate-y-1"
              >
                <button 
                  onClick={(e) => toggleSave(e, item)} 
                  className="absolute top-3 right-3 bg-black/50 p-2 rounded-full z-10 hover:bg-black/80 transition-all"
                >
                  <Star size={18} fill={isSaved ? GOLD : "none"} stroke={GOLD} />
                </button>
                
                <div className="aspect-[4/5] bg-black overflow-hidden flex items-center justify-center">
                  {item.imageUrl ? (
                    <img 
                      src={item.imageUrl} 
                      alt={item.title} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    />
                  ) : (
                    <div className="text-[10px] text-[#443830] text-center p-5 uppercase tracking-widest">
                      <ImageIcon className="mx-auto mb-2 opacity-20" size={32} />
                      Image Unavailable
                    </div>
                  )}
                </div>
                
                <div className="p-5">
                  <h3 className="italic text-lg text-[#f0e6da] truncate mb-2">{item.title}</h3>
                  <p className="text-[10px] text-[#8b7667] uppercase tracking-widest truncate">
                    {item.artist} {item.date && `• ${item.date}`}
                  </p>
                  
                  {viewMode === "curation" && (
                    <div className="mt-4 pt-4 border-t border-[#2d2520]">
                      <label className="text-[9px] text-[#c9a84c] uppercase tracking-widest mb-2 block">Curatorial Label</label>
                      <textarea 
                        className="w-full bg-black border border-[#2d2520] text-[#9e8d80] p-2 text-xs resize-none outline-none focus:border-[#c9a84c] transition-colors"
                        placeholder="Write interpretive text..."
                        value={item.curatorialLabel || ""}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateLabel(item.id, e.target.value)}
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
        {loading && (
          <div className="text-center py-12 text-[#c9a84c] tracking-[0.3em] font-light animate-pulse">
            searching the annals of time...
          </div>
        )}
      </main>

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[2000] flex items-center justify-center p-5 md:p-10 backdrop-blur-md"
            onClick={() => { setSelectedItem(null); setZoomMode(false); setGeneralZoom(1); setPanOffset({ x: 0, y: 0 }); }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#161210] border border-[#c9a84c] w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
              onClick={e => e.stopPropagation()}
            >
              {/* Image Section */}
              <div className="flex-[1.2] bg-black relative flex flex-col min-h-[400px]">
                <div 
                  className="flex-1 relative overflow-hidden flex items-center justify-center cursor-move group/zoom"
                  onMouseMove={handleMouseMove}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {activeImage ? (
                    <>
                      <img 
                        src={activeImage} 
                        alt={selectedItem.title} 
                        referrerPolicy="no-referrer"
                        className="max-w-full max-h-full object-contain transition-transform duration-200"
                        style={{ 
                          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${generalZoom})`,
                          pointerEvents: "none"
                        }} 
                      />
                      {zoomMode && (
                        <div 
                          className="absolute pointer-events-none border border-[#c9a84c] w-[150px] h-[150px] rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] overflow-hidden z-50 hidden group-hover/zoom:block"
                          style={{ 
                            left: `calc(${zoomPos.x}% - 75px)`, 
                            top: `calc(${zoomPos.y}% - 75px)`,
                            backgroundImage: `url(${activeImage})`,
                            backgroundPosition: `${zoomImgPos.x}% ${zoomImgPos.y}%`,
                            backgroundSize: `${1500 * generalZoom}%`,
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <div className="text-[#443830] uppercase tracking-widest text-xs">No Image Available</div>
                  )}
                  
                  {/* Zoom Controls */}
                  <div className="absolute top-5 right-5 flex gap-2 z-50">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setZoomMode(!zoomMode); }}
                      className={`px-3 h-8 border border-[#c9a84c] text-[10px] tracking-widest font-bold transition-all ${zoomMode ? 'bg-[#c9a84c] text-black' : 'bg-black/70 text-[#c9a84c] hover:bg-[#c9a84c] hover:text-black'}`}
                    >
                      LENS: {zoomMode ? "ON" : "OFF"}
                    </button>
                    <button 
                      onClick={() => setGeneralZoom(prev => Math.min(prev + 0.5, 5))}
                      className="bg-black/70 border border-[#c9a84c] text-[#c9a84c] p-2 hover:bg-[#c9a84c] hover:text-black transition-all"
                    >
                      <ZoomIn size={18} />
                    </button>
                    <button 
                      onClick={() => setGeneralZoom(prev => Math.max(prev - 0.5, 1))}
                      className="bg-black/70 border border-[#c9a84c] text-[#c9a84c] p-2 hover:bg-[#c9a84c] hover:text-black transition-all"
                    >
                      <ZoomOut size={18} />
                    </button>
                    <button 
                      onClick={() => { setGeneralZoom(1); setPanOffset({x:0, y:0}); }}
                      className="bg-black/70 border border-[#c9a84c] text-[#c9a84c] p-2 hover:bg-[#c9a84c] hover:text-black transition-all"
                    >
                      <Maximize2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Additional Images Gallery */}
                {(selectedItem.additionalImages && selectedItem.additionalImages.length > 0) && (
                  <div className="h-24 bg-black/50 border-t border-[#2d2520] p-2 flex gap-2 overflow-x-auto scrollbar-hide">
                    <button 
                      onClick={() => setActiveImage(selectedItem.fullSize || selectedItem.imageUrl)}
                      className={`h-full aspect-square border-2 transition-all flex-shrink-0 ${activeImage === (selectedItem.fullSize || selectedItem.imageUrl) ? 'border-[#c9a84c]' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    >
                      <img 
                        src={selectedItem.imageUrl || selectedItem.fullSize} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </button>
                    {selectedItem.additionalImages.map((img: string, i: number) => (
                      <button 
                        key={i}
                        onClick={() => setActiveImage(img)}
                        className={`h-full aspect-square border-2 transition-all flex-shrink-0 ${activeImage === img ? 'border-[#c9a84c]' : 'border-transparent opacity-50 hover:opacity-100'}`}
                      >
                        <img 
                          src={img} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Info Section */}
              <div className="flex-1 p-8 md:p-12 overflow-y-auto bg-[#161210] border-l border-[#2d2520]">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-[#c9a84c] text-3xl font-light leading-tight mb-2">{selectedItem.title}</h2>
                    <p className="text-sm text-[#8b7667] uppercase tracking-widest">
                      {selectedItem.artist} {selectedItem.date && `• ${selectedItem.date}`}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedItem(null)}
                    className="text-[#5a4a3e] hover:text-[#c9a84c] transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {selectedItem.curatorialLabel && (
                  <div className="mb-8 p-5 border-l-2 border-[#c9a84c] bg-[#c9a84c]/5 italic text-[#e8ddd4] text-base leading-relaxed">
                    "{selectedItem.curatorialLabel}"
                  </div>
                )}

                <div className="mb-10">
                  <div className="flex items-center gap-2 text-[10px] text-[#c9a84c] uppercase tracking-widest mb-3">
                    <Sparkles size={12} /> AI Curator Insight
                  </div>
                  <div className="text-sm text-[#e8ddd4] leading-relaxed bg-white/5 p-4 border border-white/5 rounded-sm">
                    {aiLoading ? (
                      <div className="flex items-center gap-3 animate-pulse">
                        <div className="w-2 h-2 bg-[#c9a84c] rounded-full" />
                        Consulting the archives...
                      </div>
                    ) : aiInsight}
                  </div>
                </div>

                <div className="space-y-4 text-sm text-[#9e8d80]">
                  <div className="grid grid-cols-3 gap-4 pb-4 border-b border-[#2d2520]">
                    <span className="text-[10px] uppercase tracking-widest text-[#5a4a3e]">Object Name</span>
                    <span className="col-span-2 text-[#e8ddd4]">{selectedItem.objectName || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pb-4 border-b border-[#2d2520]">
                    <span className="text-[10px] uppercase tracking-widest text-[#5a4a3e]">Culture</span>
                    <span className="col-span-2 text-[#e8ddd4]">{selectedItem.culture || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pb-4 border-b border-[#2d2520]">
                    <span className="text-[10px] uppercase tracking-widest text-[#5a4a3e]">Geography</span>
                    <span className="col-span-2 text-[#e8ddd4]">{selectedItem.geography || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pb-4 border-b border-[#2d2520]">
                    <span className="text-[10px] uppercase tracking-widest text-[#5a4a3e]">Medium</span>
                    <span className="col-span-2 text-[#e8ddd4]">{selectedItem.medium || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pb-4 border-b border-[#2d2520]">
                    <span className="text-[10px] uppercase tracking-widest text-[#5a4a3e]">Dimensions</span>
                    <span className="col-span-2 text-[#e8ddd4]">{selectedItem.dimensions || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pb-4 border-b border-[#2d2520]">
                    <span className="text-[10px] uppercase tracking-widest text-[#5a4a3e]">Repository</span>
                    <span className="col-span-2 text-[#e8ddd4]">{selectedItem.repository || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pb-4 border-b border-[#2d2520]">
                    <span className="text-[10px] uppercase tracking-widest text-[#5a4a3e]">Accession</span>
                    <span className="col-span-2 text-[#e8ddd4] font-mono">{selectedItem.accession}</span>
                  </div>
                  
                  {selectedItem.tags && selectedItem.tags.length > 0 && (
                    <div className="pt-4">
                      <span className="text-[10px] uppercase tracking-widest text-[#5a4a3e] block mb-3">Tags</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.tags.map((tag: string) => (
                          <span key={tag} className="px-2 py-1 bg-[#2d2520] text-[#8b7667] text-[10px] uppercase tracking-wider rounded-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedItem.galleryNumber && (
                    <div className="mt-8 p-4 border border-[#c9a84c] text-[#c9a84c] text-center font-bold text-xs tracking-[0.2em]">
                      CURRENTLY ON VIEW: GALLERY {selectedItem.galleryNumber}
                    </div>
                  )}
                </div>

                <div className="mt-12 flex flex-col gap-3">
                  <a 
                    href={selectedItem.metUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center justify-center gap-2 bg-[#c9a84c] text-black py-4 font-bold text-xs tracking-widest hover:bg-[#b39540] transition-all"
                  >
                    <ExternalLink size={14} /> VIEW AT THE MET
                  </a>
                  <button 
                    onClick={() => setSelectedItem(null)}
                    className="border border-[#2d2520] text-[#6e5a4b] py-4 text-xs tracking-widest hover:bg-[#1d1916] transition-all"
                  >
                    CLOSE GALLERY
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AUTH MODAL */}
      <AnimatePresence>
        {authVisible && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[3000] flex items-center justify-center p-5 backdrop-blur-sm"
            onClick={() => setAuthVisible(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#161210] border border-[#c9a84c] p-10 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-[#c9a84c] text-2xl text-center tracking-widest mb-8">
                {authMode === "login" ? "ACCESS ARCHIVES" : "REGISTER ACCOUNT"}
              </h3>
              <div className="space-y-4">
                <input 
                  className="w-full bg-black border border-[#2d2520] text-white p-4 outline-none focus:border-[#c9a84c] transition-colors" 
                  placeholder="Email Address" 
                  onChange={e => setCreds({...creds, email: e.target.value})} 
                />
                <input 
                  className="w-full bg-black border border-[#2d2520] text-white p-4 outline-none focus:border-[#c9a84c] transition-colors" 
                  type="password" 
                  placeholder="Password" 
                  onChange={e => setCreds({...creds, password: e.target.value})} 
                />
                <button 
                  onClick={handleAuth} 
                  className="w-full bg-[#c9a84c] text-black py-4 font-bold tracking-widest hover:bg-[#b39540] transition-colors mt-4"
                >
                  {authMode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
                </button>
                <p 
                  onClick={() => setAuthMode(authMode === "login" ? "register" : "login")} 
                  className="text-[#5a4a3e] text-center mt-6 cursor-pointer hover:text-[#c9a84c] transition-colors text-sm underline underline-offset-4"
                >
                  {authMode === "login" ? "Need a member account? Register" : "Already a member? Sign in"}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

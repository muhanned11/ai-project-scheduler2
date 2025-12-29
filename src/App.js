// Print button layout src/App.js
import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  Sparkles,
  BarChart3,
  Table2,
  Grid3x3,
  Trash2,
  Users,
  DollarSign,
  AlertTriangle,
  Calendar,
  TrendingUp,
  Search,
  Filter,
  X,

  CheckCircle,
  Clock,
  Play,
  Pause,
  LogOut,
  Plus,
  ZoomIn,
  ZoomOut,
  MessageSquare,
  Copy,
  Check,
} from "lucide-react";
import "./App.css";

// Firebase imports
import { db, auth } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

function App() {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [projectDescription, setProjectDescription] = useState("");
  const [aiCommand, setAiCommand] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [conversationHistory, setConversationHistory] = useState([]);
  const [viewMode, setViewMode] = useState("gantt");
  const [selectedTask, setSelectedTask] = useState(null);
  // ===== Resource Center =====
const [resources, setResources] = useState([]); // Resource Center data

// Make sure currentProject has resources array
useEffect(() => {
  if (!currentProject) return;
  if (!Array.isArray(currentProject.resources)) {
    const updated = { ...currentProject, resources: [] };
    setCurrentProject(updated);
    saveProject(updated);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentProject?.id]);


  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Chat
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState(null);

  // Gantt zoom + scale
  const [ganttZoom, setGanttZoom] = useState(1.0);
  const [timeScale, setTimeScale] = useState("month"); // day | week | month | quarter | year

  // Add Task modal
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({
    parentId: null,
    name: "",
    duration: 5,
    resources: "",
    cost: 0,
    priority: "Medium",
    status: "Not Started",
    riskLevel: "Low",
    notes: "",
  });

  // Auth
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ✅ PRINT
  const handlePrint = () => {
    window.print();
  };

  // API config
  const isDevelopment =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const API_PROXY = isDevelopment
    ? "http://localhost:3001"
    : "https://ai-scheduler-pvl1.onrender.com";

  // Health check
  useEffect(() => {
    const checkAPI = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${API_PROXY}/health`, {
          signal: controller.signal,
        }).catch(() => null);

        clearTimeout(timeoutId);

        if (response && response.ok) {
          console.log("✅ API server reachable");
        } else {
          console.warn("⚠️ API server not responding");
        }
      } catch (e) {
        console.warn("⚠️ API check failed:", e?.message);
      }
    };
    checkAPI();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        loadProjects(currentUser);
      } else {
        setProjects([]);
        setCurrentProject(null);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load projects
  const loadProjects = async (u = user) => {
    if (!u) return;
    try {
      const q = query(
        collection(db, "projects"),
        where("userId", "==", u.uid),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const loaded = [];
      querySnapshot.forEach((docSnap) => {
        loaded.push({
          ...docSnap.data(),
          firebaseId: docSnap.id,
          id: docSnap.id,
        });
      });
      setProjects(loaded);
    } catch (error) {
      console.error("Error loading projects:", error);
      alert("Error loading projects: " + error.message);
    }
  };

  // Expand all
  const expandAllNodes = (wbs) => {
    const expanded = new Set();
    const traverse = (nodes) => {
      nodes.forEach((node) => {
        expanded.add(node.id);
        if (node.children?.length) traverse(node.children);
      });
    };
    traverse(wbs || []);
    return expanded;
  };

  // Auto-expand on project change
  useEffect(() => {
    if (currentProject?.wbs) {
      setExpandedNodes(expandAllNodes(currentProject.wbs));
    }
  }, [currentProject?.id]);

  // Save project
  const saveProject = async (project) => {
    if (!user) {
      alert("Please sign in to save projects");
      return;
    }
    try {
      const projectData = {
        ...project,
        conversationHistory: project.conversationHistory || [],
        userId: user.uid,
        lastModified: new Date().toISOString(),
      };
      const { firebaseId, ...dataToSave } = projectData;

      if (project.firebaseId) {
        await updateDoc(doc(db, "projects", project.firebaseId), dataToSave);
      } else {
        const docRef = await addDoc(collection(db, "projects"), dataToSave);
        project.firebaseId = docRef.id;
        project.id = docRef.id;
      }
      await loadProjects();
    } catch (error) {
      console.error("Error saving project:", error);
      alert("Failed to save project: " + error.message);
    }
  };

  const deleteProject = async (projectId) => {
    if (!window.confirm("Delete this project? This cannot be undone.")) {
      return;
    }
    try {
      const p = projects.find((x) => x.id === projectId);
      if (p?.firebaseId) await deleteDoc(doc(db, "projects", p.firebaseId));
      await loadProjects();
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Failed to delete project: " + error.message);
    }
  };

  // Auth actions
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in:", error);
      alert("Failed to sign in: " + error.message);
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      setCurrentProject(null);
      setProjects([]);
    } catch (error) {
      console.error("Error signing out:", error);
      alert("Failed to sign out: " + error.message);
    }
  };

  // Helpers
  const getAllTasks = (wbs) => {
    const tasks = [];
    const walk = (nodes) => {
      nodes.forEach((n) => {
        tasks.push(n);
        if (n.children?.length) walk(n.children);
      });
    };
    if (wbs) walk(wbs);
    return tasks;
  };

  const getStatusColor = (status) => {
    const colors = {
      "Not Started": "#6b7280",
      "In Progress": "#3b82f6",
      Completed: "#10b981",
      "On Hold": "#f59e0b",
      Blocked: "#ef4444",
    };
    return colors[status] || "#6b7280";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      High: "#ef4444",
      Medium: "#f59e0b",
      Low: "#10b981",
    };
    return colors[priority] || "#6b7280";
  };

  const getRiskColor = (risk) => {
    const colors = {
      High: "#ef4444",
      Medium: "#f59e0b",
      Low: "#10b981",
    };
    return colors[risk] || "#6b7280";
  };

  const calculateProjectDates = (wbs) => {
    if (!wbs?.length) return { start: new Date(), end: new Date() };
    let earliest = new Date(wbs[0].startDate);
    let latest = new Date(wbs[0].endDate);

    const walk = (nodes) => {
      nodes.forEach((n) => {
        const s = new Date(n.startDate);
        const e = new Date(n.endDate);
        if (s < earliest) earliest = s;
        if (e > latest) latest = e;
        if (n.children?.length) walk(n.children);
      });
    };
    walk(wbs);
    return { start: earliest, end: latest };
  };

  const toggleNodeExpansion = (nodeId) => {
    const next = new Set(expandedNodes);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    setExpandedNodes(next);
  };

  const updateTaskField = (taskId, field, value) => {
    const updateNode = (nodes) =>
      nodes.map((n) => {
        if (n.id === taskId) return { ...n, [field]: value };
        if (n.children?.length) return { ...n, children: updateNode(n.children) };
        return n;
      });
const addResource = () => {
  const next = {
    resourceId: `R-${Date.now()}`, // unique (simple)
    resourceName: "",
    type: "labor",        // labor | material | equipment | cost
    costUnit: "hour",     // hour | day | week | month | year
    unitPrice: 0,
  };

  const updated = {
    ...currentProject,
    resources: [...(currentProject.resources || []), next],
    lastModified: new Date().toISOString(),
  };
  setCurrentProject(updated);
  saveProject(updated);
};

const updateResourceField = (index, field, value) => {
  const updatedResources = (currentProject.resources || []).map((r, i) =>
    i === index ? { ...r, [field]: value } : r
  );

  const updated = {
    ...currentProject,
    resources: updatedResources,
    lastModified: new Date().toISOString(),
  };
  setCurrentProject(updated);
  saveProject(updated);
};

const deleteResource = (index) => {
  const updatedResources = (currentProject.resources || []).filter((_, i) => i !== index);

  const updated = {
    ...currentProject,
    resources: updatedResources,
    lastModified: new Date().toISOString(),
  };
  setCurrentProject(updated);
  saveProject(updated);
};

    const updatedProject = {
      ...currentProject,
      wbs: updateNode(currentProject.wbs),
      lastModified: new Date().toISOString(),
    };
    setCurrentProject(updatedProject);
    saveProject(updatedProject);
  };

  // Flatten for line numbers
  const flattenWBSWithLineNumbers = (wbs, expanded) => {
    const out = [];
    let line = 0;
    const walk = (nodes, depth = 0) => {
      nodes.forEach((n) => {
        line += 1;
        out.push({
          ...n,
          lineNumber: line,
          depth,
          isExpanded: expanded.has(n.id),
          hasChildren: !!(n.children?.length),
        });
        if (expanded.has(n.id) && n.children?.length) walk(n.children, depth + 1);
      });
    };
    walk(wbs || []);
    return out;
  };

  // Filters
  const filteredTasks = useMemo(() => {
    if (!currentProject?.wbs) return [];
    let tasks = getAllTasks(currentProject.wbs);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.name?.toLowerCase().includes(q) ||
          t.id?.toLowerCase().includes(q) ||
          t.resources?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") tasks = tasks.filter((t) => t.status === statusFilter);
    if (priorityFilter !== "all") tasks = tasks.filter((t) => t.priority === priorityFilter);
    return tasks;
  }, [currentProject, searchQuery, statusFilter, priorityFilter]);

  const projectStats = useMemo(() => {
    if (!currentProject?.wbs) return null;
    const all = getAllTasks(currentProject.wbs);
    const totalTasks = all.length;
    const completedTasks = all.filter((t) => t.status === "Completed").length;
    const inProgressTasks = all.filter((t) => t.status === "In Progress").length;
    const notStartedTasks = all.filter((t) => t.status === "Not Started").length;
    const blockedTasks = all.filter((t) => t.status === "Blocked").length;
    const highPriorityTasks = all.filter((t) => t.priority === "High").length;
    const totalCost = all.reduce((sum, t) => sum + (t.cost || 0), 0);
    const avgProgress =
      totalTasks > 0 ? all.reduce((sum, t) => sum + (t.progress || 0), 0) / totalTasks : 0;
    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      notStartedTasks,
      blockedTasks,
      highPriorityTasks,
      totalCost,
      avgProgress: Math.round(avgProgress),
    };
  }, [currentProject]);

  const handleStatusClick = (status) => {
    setStatusFilter(status);
    setShowFilters(true);
    setViewMode("table");
  };

  const handlePriorityClick = (priority) => {
    setPriorityFilter(priority);
    setShowFilters(true);
    setViewMode("table");
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
  };

  // Zoom control
  const handleZoom = (direction) => {
    const scales = ["day", "week", "month", "quarter", "year"];
    const currentIndex = scales.indexOf(timeScale);

    if (direction === "in") {
      if (currentIndex > 0) {
        setTimeScale(scales[currentIndex - 1]);
        setGanttZoom(1.0);
      } else {
        setGanttZoom((z) => Math.min(z * 1.25, 6));
      }
    } else {
      if (currentIndex < scales.length - 1) {
        setTimeScale(scales[currentIndex + 1]);
        setGanttZoom(1.0);
      } else {
        setGanttZoom((z) => Math.max(z / 1.25, 0.2));
      }
    }
  };

  const handleGanttWheel = (e) => {
    if (!e.ctrlKey && Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (e.deltaY < 0) handleZoom("in");
    else handleZoom("out");
  };

  useEffect(() => {
    const onKey = (e) => {
      if (viewMode !== "gantt") return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        handleZoom("in");
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        handleZoom("out");
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        setGanttZoom(1);
        setTimeScale("month");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode, timeScale]);

  // ===== Timescale helpers =====
  const getScaleMeta = (scale) => {
    const floorToWeek = (d) => {
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const day = x.getDay(); // 0=Sun
      const diff = (day + 6) % 7; // Mon=0 ... Sun=6
      x.setDate(x.getDate() - diff);
      return x;
    };

    switch (scale) {
      case "day":
        return {
          avgDaysPerCell: 1,
          addUnit: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
          floor: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()),
          topTier: "month",
        };
      case "week":
        return {
          avgDaysPerCell: 7,
          addUnit: (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7),
          floor: (d) => floorToWeek(d),
          topTier: "month",
        };
      case "month":
        return {
          avgDaysPerCell: 30,
          addUnit: (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1),
          floor: (d) => new Date(d.getFullYear(), d.getMonth(), 1),
          topTier: "year",
        };
      case "quarter":
        return {
          avgDaysPerCell: 91,
          addUnit: (d) => new Date(d.getFullYear(), d.getMonth() + 3, 1),
          floor: (d) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1),
          topTier: "year",
        };
      case "year":
      default:
        return {
          avgDaysPerCell: 365,
          addUnit: (d) => new Date(d.getFullYear() + 1, 0, 1),
          floor: (d) => new Date(d.getFullYear(), 0, 1),
          topTier: null,
        };
    }
  };

  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const formatCellLabel = (scale, startDate) => {
    const m = startDate.getMonth();
    const y = startDate.getFullYear();
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (scale === "day") return String(startDate.getDate());
    if (scale === "week") return `W${getWeekNumber(startDate)}`;
    if (scale === "month") return mon[m];
    if (scale === "quarter") return `Q${Math.floor(m / 3) + 1}`;
    return String(y);
  };

  const formatCellSubLabel = (scale, startDate) => {
    const y = startDate.getFullYear();
    const day = ["S", "M", "T", "W", "T", "F", "S"][startDate.getDay()];
    if (scale === "day") return day;
    if (scale === "week") {
      const weekEnd = new Date(startDate);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${startDate.getDate()}-${weekEnd.getDate()}`;
    }
    if (scale === "month") return String(y).substring(2);
    return "";
  };

  const buildTimeCells = (scale, projectStart, projectEnd, pxPerDay) => {
    const meta = getScaleMeta(scale);
    const start = meta.floor(projectStart);
    const endExclusive = new Date(projectEnd.getFullYear(), projectEnd.getMonth(), projectEnd.getDate() + 1);
    const cells = [];
    let cursor = new Date(start);

    while (cursor < endExclusive) {
      const next = meta.addUnit(cursor);
      const cellEnd = next < endExclusive ? next : endExclusive;
      const cellDays = Math.max(1, Math.ceil((cellEnd - cursor) / 86400000));
      const width = cellDays * pxPerDay;
      cells.push({
        start: new Date(cursor),
        end: new Date(cellEnd),
        days: cellDays,
        width,
        label: formatCellLabel(scale, cursor),
        subLabel: formatCellSubLabel(scale, cursor),
      });
      cursor = next;
    }
    return cells;
  };

  const buildTopHeaders = (topTier, cells) => {
    if (!topTier) return [];
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const headers = [];
    let currentKey = null;
    let accWidth = 0;
    let firstStart = null;

    const push = () => {
      if (!currentKey) return;
      let label = "";
      if (topTier === "month") label = `${mon[firstStart.getMonth()]} ${firstStart.getFullYear()}`;
      if (topTier === "year") label = `${firstStart.getFullYear()}`;
      headers.push({ key: currentKey, label, width: accWidth });
    };

    cells.forEach((c) => {
      let key = "";
      if (topTier === "month") key = `${c.start.getFullYear()}-${c.start.getMonth()}`;
      if (topTier === "year") key = `${c.start.getFullYear()}`;
      if (currentKey === null) {
        currentKey = key;
        firstStart = c.start;
      }
      if (key !== currentKey) {
        push();
        currentKey = key;
        firstStart = c.start;
        accWidth = 0;
      }
      accWidth += c.width;
    });

    push();
    return headers;
  };

  // ===== AI COMMAND =====
  const processAICommand = async () => {
    if (!aiCommand.trim() || !currentProject) return;
    setIsProcessingCommand(true);

    try {
      const commandLower = aiCommand.toLowerCase().trim();

      // Quick actions (no AI)
      const quickActions = {
        "mark all complete": () => {
          const mark = (nodes) =>
            nodes.map((n) => ({
              ...n,
              status: "Completed",
              progress: 100,
              children: n.children ? mark(n.children) : [],
            }));
          return { ...currentProject, wbs: mark(currentProject.wbs) };
        },
        "reset all progress": () => {
          const reset = (nodes) =>
            nodes.map((n) => ({
              ...n,
              status: "Not Started",
              progress: 0,
              children: n.children ? reset(n.children) : [],
            }));
          return { ...currentProject, wbs: reset(currentProject.wbs) };
        },
      };

      if (quickActions[commandLower]) {
        const updatedProject = quickActions[commandLower]();
        updatedProject.lastModified = new Date().toISOString();
        await saveProject(updatedProject);
        setCurrentProject(updatedProject);
        setAiCommand("");
        return;
      }

      // AI call
      const response = await fetch(`${API_PROXY}/api/claude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8000,
          messages: [
            {
              role: "user",
              content: `You are a (Project Management Professional) expert. Modify this project based on the user's command.

CURRENT PROJECT JSON:
${JSON.stringify(currentProject, null, 2)}

USER COMMAND: "${aiCommand}"

CRITICAL INSTRUCTIONS:
1. Return VALID JSON ONLY (no markdown, no text)
2. Must be parseable JSON (double quotes, no trailing commas)
3. Keep ALL existing tasks unless changed
Return COMPLETE updated project JSON.`,
            },
          ],
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || "Unknown API error");
      const responseText = data.content?.find((b) => b.type === "text")?.text || "";
      if (!responseText) throw new Error("No response from AI");

      let cleaned = responseText
        .trim()
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .replace(/`/g, "");
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first === -1 || last === -1) throw new Error("AI did not return JSON");
      cleaned = cleaned.substring(first, last + 1);

      const fixJSON = (s) =>
        s
          .replace(/,(\s*[}\]])/g, "$1")
          .replace(/\/\/.*/g, "")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .trim();

      let updatedProject;
      try {
        updatedProject = JSON.parse(cleaned);
      } catch {
        updatedProject = JSON.parse(fixJSON(cleaned));
      }

      if (!updatedProject.wbs || !Array.isArray(updatedProject.wbs)) {
        throw new Error("Invalid project structure - missing WBS array");
      }

      // Preserve IDs
      updatedProject.lastModified = new Date().toISOString();
      updatedProject.firebaseId = currentProject.firebaseId;
      updatedProject.id = currentProject.id;
      updatedProject.userId = currentProject.userId;
      updatedProject.createdAt = currentProject.createdAt;

      // Add conversation history entry
      const chatEntry = {
        id: `chat-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userPrompt: aiCommand,
        aiResponse: "Project updated successfully",
        tasksModified: getAllTasks(updatedProject.wbs).length,
        action: "command",
      };
      updatedProject.conversationHistory = [
        ...(currentProject.conversationHistory || []),
        chatEntry,
      ];

      await saveProject(updatedProject);
      setCurrentProject(updatedProject);

      setConversationHistory((h) => [
        ...h,
        { role: "user", content: aiCommand },
        { role: "assistant", content: "Updated project" },
      ]);
      setAiCommand("");
    } catch (error) {
      console.error(error);
      alert("Error processing command:\n\n" + error.message);
    } finally {
      setIsProcessingCommand(false);
    }
  };

  // Generate WBS
  const generateWBS = async () => {
    if (!projectDescription.trim()) return;
    if (!user) {
      alert("Please sign in to create projects");
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(`${API_PROXY}/api/claude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [
            {
              role: "user",
              content: `Create a project plan (4-5 phases, 3-5 tasks each) for:
${projectDescription}

Return ONLY JSON with this shape:
{
  "projectName":"...",
  "projectStart":"2025-01-20",
  "projectBudget":200000,
  "projectManager":"Project Manager",
  "wbs":[ ... ]
}`,
            },
          ],
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || "Unknown API error");
      const responseText = data.content?.find((b) => b.type === "text")?.text || "";
      if (!responseText) throw new Error("No response from AI");

      let cleaned = responseText.trim().replace(/```json/g, "").replace(/```/g, "").replace(/`/g, "");
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first === -1 || last === -1) throw new Error("AI did not return JSON");
      cleaned = cleaned.substring(first, last + 1);

      const parsed = JSON.parse(cleaned);

      const chatEntry = {
        id: `chat-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userPrompt: projectDescription,
        aiResponse: `Generated project "${parsed.projectName || "Unnamed Project"}"`,
        tasksModified: parsed.wbs?.length || 0,
        action: "generate",
      };

      const newProject = {
        name: parsed.projectName || "Unnamed Project",
        description: projectDescription,
        projectStart: parsed.projectStart || new Date().toISOString().split("T")[0],
        projectBudget: parsed.projectBudget || 0,
        projectManager: parsed.projectManager || "Project Manager",
        wbs: parsed.wbs || [],
        conversationHistory: [chatEntry],
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        userId: user.uid,
      };

      await saveProject(newProject);
      setCurrentProject(newProject);
      setConversationHistory([
        { role: "user", content: "Generate WBS for: " + projectDescription },
        { role: "assistant", content: "Generated project successfully." },
      ]);
      setProjectDescription("");
      setExpandedNodes(expandAllNodes(newProject.wbs));
    } catch (error) {
      console.error(error);
      alert("Error generating project: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Template projects (short)
  const createTemplateProject = async (type) => {
    if (!user) return alert("Please sign in to create projects");
    const templates = {
      software: {
        name: "E-Commerce Mobile App",
        description: "Full-stack mobile application with payment integration",
        budget: 400000,
        manager: "Mike Chen",
        phases: [
          { name: "Planning & Design", duration: 15, tasks: ["Requirements", "UI/UX Design", "Architecture"] },
          { name: "Backend", duration: 25, tasks: ["API", "Database", "Auth"] },
          { name: "Frontend", duration: 25, tasks: ["App Setup", "UI Components", "API Integration"] },
          { name: "Testing", duration: 15, tasks: ["Unit", "Integration", "UAT"] },
          { name: "Deployment", duration: 10, tasks: ["Release", "Production", "Monitoring"] },
        ],
      },
    };
    const template = templates[type];
    if (!template) return;

    const startDate = new Date();
    let currentDate = new Date(startDate);

    const wbs = template.phases.map((phase, idx) => {
      const phaseId = String(idx + 1);
      const phaseStart = new Date(currentDate);
      const phaseEnd = new Date(phaseStart);
      phaseEnd.setDate(phaseEnd.getDate() + phase.duration);

      const taskDuration = Math.max(1, Math.floor(phase.duration / phase.tasks.length));
      let taskDate = new Date(phaseStart);

      const children = phase.tasks.map((taskName, tIdx) => {
        const taskEnd = new Date(taskDate);
        taskEnd.setDate(taskEnd.getDate() + taskDuration);
        const task = {
          id: `${phaseId}.${tIdx + 1}`,
          name: taskName,
          level: 2,
          duration: taskDuration,
          startDate: taskDate.toISOString().split("T")[0],
          endDate: taskEnd.toISOString().split("T")[0],
          progress: 0,
          resources: "Team Member",
          cost: Math.round(template.budget / (template.phases.length * phase.tasks.length)),
          priority: tIdx === 0 ? "High" : "Medium",
          status: "Not Started",
          dependencies: [],
          riskLevel: "Low",
          notes: `${taskName} for ${phase.name}`,
          children: [],
        };
        taskDate = new Date(taskEnd);
        return task;
      });

      currentDate = new Date(phaseEnd);

      return {
        id: phaseId,
        name: phase.name,
        level: 1,
        duration: phase.duration,
        startDate: phaseStart.toISOString().split("T")[0],
        endDate: phaseEnd.toISOString().split("T")[0],
        progress: 0,
        resources: "Project Team",
        cost: Math.round(template.budget / template.phases.length),
        priority: "High",
        status: "Not Started",
        dependencies: idx > 0 ? [String(idx)] : [],
        riskLevel: "Medium",
        notes: phase.name,
        children,
      };
    });

    const newProject = {
      name: template.name,
      description: template.description,
      projectStart: startDate.toISOString().split("T")[0],
      projectBudget: template.budget,
      projectManager: template.manager,
      wbs,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      userId: user.uid,
    };

    await saveProject(newProject);
    setCurrentProject(newProject);
    setExpandedNodes(expandAllNodes(newProject.wbs));
  };

  // Add task manually
  const addTaskManually = () => {
    if (!newTask.name.trim()) {
      alert("Please enter a task name");
      return;
    }

    const updatedProject = { ...currentProject };

    const findParentAndAdd = (nodes, parentId) => {
      for (const node of nodes) {
        if (node.id === parentId) {
          const newId = `${node.id}.${(node.children?.length || 0) + 1}`;
          const parentEnd = new Date(node.endDate);
          const taskStart = new Date(parentEnd);
          taskStart.setDate(taskStart.getDate() + 1);
          const taskEnd = new Date(taskStart);
          taskEnd.setDate(taskEnd.getDate() + parseInt(newTask.duration, 10));

          const task = {
            id: newId,
            name: newTask.name,
            level: node.level + 1,
            duration: parseInt(newTask.duration, 10),
            startDate: taskStart.toISOString().split("T")[0],
            endDate: taskEnd.toISOString().split("T")[0],
            progress: 0,
            resources: newTask.resources || "Team Member",
            cost: parseFloat(newTask.cost) || 0,
            priority: newTask.priority,
            status: newTask.status,
            dependencies: [],
            riskLevel: newTask.riskLevel,
            notes: newTask.notes || "",
            children: [],
          };

          node.children = node.children || [];
          node.children.push(task);
          return true;
        }
        if (node.children?.length && findParentAndAdd(node.children, parentId)) return true;
      }
      return false;
    };

    if (!newTask.parentId) {
      const newPhaseId = String((updatedProject.wbs?.length || 0) + 1);
      const lastPhase = updatedProject.wbs[updatedProject.wbs.length - 1];
      const phaseStart = lastPhase ? new Date(lastPhase.endDate) : new Date();
      if (lastPhase) phaseStart.setDate(phaseStart.getDate() + 1);
      const phaseEnd = new Date(phaseStart);
      phaseEnd.setDate(phaseEnd.getDate() + parseInt(newTask.duration, 10));

      updatedProject.wbs.push({
        id: newPhaseId,
        name: newTask.name,
        level: 1,
        duration: parseInt(newTask.duration, 10),
        startDate: phaseStart.toISOString().split("T")[0],
        endDate: phaseEnd.toISOString().split("T")[0],
        progress: 0,
        resources: newTask.resources || "Project Team",
        cost: parseFloat(newTask.cost) || 0,
        priority: newTask.priority,
        status: newTask.status,
        dependencies: lastPhase ? [lastPhase.id] : [],
        riskLevel: newTask.riskLevel,
        notes: newTask.notes || "",
        children: [],
      });
    } else {
      findParentAndAdd(updatedProject.wbs, newTask.parentId);
    }

    updatedProject.lastModified = new Date().toISOString();
    setCurrentProject(updatedProject);
    saveProject(updatedProject);

    setShowAddTaskModal(false);
    setNewTask({
      parentId: null,
      name: "",
      duration: 5,
      resources: "",
      cost: 0,
      priority: "Medium",
      status: "Not Started",
      riskLevel: "Low",
      notes: "",
    });
  };

  // ===== Views =====
  const renderGanttView = () => {
    if (!currentProject?.wbs) return null;

    const projectDates = calculateProjectDates(currentProject.wbs);
    const baseDayWidth = 50;
    const { avgDaysPerCell, topTier } = getScaleMeta(timeScale);
    const pxPerDay = (baseDayWidth * ganttZoom) / avgDaysPerCell;

    const timeCells = buildTimeCells(timeScale, projectDates.start, projectDates.end, pxPerDay);
    const topHeaders = buildTopHeaders(topTier, timeCells);

    const getTaskPosition = (task) => {
      const taskStart = new Date(task.startDate);
      const daysFromStart = Math.ceil((taskStart - projectDates.start) / 86400000);
      return daysFromStart * pxPerDay;
    };

    const getTaskWidth = (task) => Math.max(task.duration * pxPerDay, 6);

    const renderGanttRow = (node, depth = 0) => {
      const isExpanded = expandedNodes.has(node.id);
      const hasChildren = !!(node.children?.length);
      const left = getTaskPosition(node);
      const width = getTaskWidth(node);

      return (
        <React.Fragment key={node.id}>
          <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
            {/* Line */}
            <div
              style={{
                width: "50px",
                minWidth: "50px",
                padding: "0.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: node.level === 1 ? "#f9fafb" : "white",
                borderRight: "1px solid #e5e7eb",
                height: "48px",
              }}
            >
              <span
                style={{
                  color: "#9ca3af",
                  fontWeight: "500",
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                }}
              >
                {node.lineNumber}
              </span>
            </div>

            {/* WBS */}
            <div
              style={{
                width: "70px",
                minWidth: "70px",
                padding: "0.75rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: node.level === 1 ? "#f9fafb" : "white",
                borderRight: "2px solid #e5e7eb",
                height: "48px",
              }}
            >
              <span
                style={{
                  color: "#2563eb",
                  fontWeight: "700",
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                }}
              >
                {node.id}
              </span>
            </div>

            {/* Name */}
            <div
              style={{
                width: "320px",
                minWidth: "320px",
                padding: "0.75rem",
                paddingLeft: `${0.75 + depth * 1.5}rem`,
                display: "flex",
                alignItems: "center",
                background: node.level === 1 ? "#f9fafb" : "white",
                borderRight: "2px solid #e5e7eb",
                height: "48px",
              }}
            >
              {hasChildren ? (
                <button
                  onClick={() => toggleNodeExpansion(node.id)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    marginRight: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    color: "#6b7280",
                  }}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : (
                <span style={{ width: "24px", marginRight: "0.5rem" }} />
              )}
              <span
                style={{
                  fontWeight: node.level === 1 ? "700" : "500",
                  fontSize: node.level === 1 ? "1rem" : "0.875rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {node.name}
              </span>
            </div>

            {/* Timeline bar */}
            <div style={{ flex: 1, position: "relative", height: "48px", background: "white" }}>
              <div
                style={{
                  position: "absolute",
                  left: `${left}px`,
                  width: `${width}px`,
                  height: "32px",
                  top: "8px",
                  background: getStatusColor(node.status),
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  transition: "all 0.2s",
                  overflow: "hidden",
                }}
                onClick={() => setSelectedTask(node)}
                title={`${node.name}\n${node.startDate} → ${node.endDate}\n${node.progress}%`}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${node.progress}%`,
                    background: "rgba(255,255,255,0.3)",
                    transition: "width 0.3s",
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "0 12px",
                    width: "100%",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: "600",
                      color: "white",
                      textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      flex: 1,
                    }}
                  >
                    {node.name}
                  </span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: "700",
                      color: "white",
                      textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                      backgroundColor: "rgba(0,0,0,0.2)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {node.progress}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </React.Fragment>
      );
    };

    return (
      // ✅ THIS is the printable area
      <div
        className="print-gantt"
        style={{
          background: "white",
          borderRadius: "1rem",
          border: "2px solid #e5e7eb",
          overflow: "hidden",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          transition: "all 0.3s ease-in-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            borderBottom: "2px solid #e5e7eb",
            background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
            color: "white",
          }}
        >
          <div
            style={{
              width: "400px",
              minWidth: "400px",
              display: "flex",
              borderRight: "2px solid rgba(255,255,255,0.2)",
            }}
          >
            <div style={{ width: "50px", minWidth: "50px", padding: "1rem", textAlign: "center", fontWeight: 700, fontSize: "13px", borderRight: "1px solid rgba(255,255,255,0.2)" }}>
              #
            </div>
            <div style={{ width: "70px", minWidth: "70px", padding: "1rem", textAlign: "center", fontWeight: 700, fontSize: "13px", borderRight: "1px solid rgba(255,255,255,0.2)" }}>
              WBS
            </div>
            <div style={{ flex: 1, padding: "1rem", fontWeight: 700, fontSize: "13px" }}>
              TASK
            </div>
          </div>

          {/* Timescale headers */}
          <div style={{ flex: 1, overflowX: "auto" }} onWheel={handleGanttWheel}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {topHeaders.length > 0 && (
                <div style={{ display: "flex" }}>
                  {topHeaders.map((h) => (
                    <div
                      key={h.key}
                      style={{
                        width: `${h.width}px`,
                        minWidth: `${h.width}px`,
                        padding: "0.5rem 0",
                        textAlign: "center",
                        borderRight: "1px solid rgba(255,255,255,0.15)",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        background: "rgba(255,255,255,0.08)",
                      }}
                    >
                      {h.label}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex" }}>
                {timeCells.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      width: `${c.width}px`,
                      minWidth: `${c.width}px`,
                      padding: "0.75rem 0.25rem",
                      textAlign: "center",
                      borderRight: "1px solid rgba(255,255,255,0.15)",
                      borderLeft: i === 0 ? "1px solid rgba(255,255,255,0.15)" : "none",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      background: "rgba(255,255,255,0.05)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <div>{c.label}</div>
                    <div style={{ fontSize: "10px", opacity: 0.9 }}>{c.subLabel}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ maxHeight: "600px", overflowY: "auto", position: "relative" }}>
          {/* Background grid */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "400px",
              right: 0,
              bottom: 0,
              display: "flex",
              pointerEvents: "none",
              zIndex: 0,
            }}
          >
            {timeCells.map((c, i) => (
              <div
                key={i}
                style={{
                  width: `${c.width}px`,
                  minWidth: `${c.width}px`,
                  borderRight: "1px solid #e5e7eb",
                  background:
                    timeScale === "day" &&
                    (new Date(c.start).getDay() === 0 || new Date(c.start).getDay() === 6)
                      ? "#f3f4f6"
                      : "transparent",
                }}
              />
            ))}
          </div>

          {/* Rows */}
          <div style={{ position: "relative", zIndex: 1 }}>
            {flattenWBSWithLineNumbers(currentProject.wbs, expandedNodes).map((task) =>
              renderGanttRow(task, task.depth)
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTableView = () => {
    const allTasks = filteredTasks.length > 0 ? filteredTasks : getAllTasks(currentProject.wbs);
    return (
      <div className="table-view-container">
        <table className="table-view">
          <thead>
            <tr>
              <th>#</th>
              <th>WBS</th>
              <th>Task Name</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Start</th>
              <th>End</th>
              <th>Duration</th>
              <th>Progress</th>
              <th>Resources</th>
              <th>Cost</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {allTasks.map((task, idx) => (
              <tr key={task.id} className={`level-${task.level} ${idx % 2 === 0 ? "even" : ""}`}>
                <td className="line-number-cell">{idx + 1}</td>
                <td className="wbs-cell">{task.id}</td>
                <td>
                  <span style={{ paddingLeft: `${(task.level - 1) * 1.5}rem` }}>{task.name}</span>
                </td>
                <td>
                  <select
                    value={task.status}
                    onChange={(e) => updateTaskField(task.id, "status", e.target.value)}
                    className="table-input"
                    style={{ backgroundColor: getStatusColor(task.status), color: "white", fontWeight: "bold" }}
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </td>
                <td>
                  <select
                    value={task.priority}
                    onChange={(e) => updateTaskField(task.id, "priority", e.target.value)}
                    className="table-input"
                    style={{ color: getPriorityColor(task.priority), fontWeight: "bold" }}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </td>
                <td>
                  <input
                    type="date"
                    value={task.startDate}
                    onChange={(e) => updateTaskField(task.id, "startDate", e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={task.endDate}
                    onChange={(e) => updateTaskField(task.id, "endDate", e.target.value)}
                    className="table-input"
                  />
                </td>
                <td className="text-center">{task.duration}</td>
                <td>
                  <input
                    type="number"
                    value={task.progress}
                    onChange={(e) =>
                      updateTaskField(
                        task.id,
                        "progress",
                        Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))
                      )
                    }
                    className="table-input"
                    min="0"
                    max="100"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={task.resources || ""}
                    onChange={(e) => updateTaskField(task.id, "resources", e.target.value)}
                    className="table-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={task.cost || 0}
                    onChange={(e) => updateTaskField(task.id, "cost", parseFloat(e.target.value) || 0)}
                    className="table-input"
                  />
                </td>
                <td>
                  <select
                    value={task.riskLevel || "Low"}
                    onChange={(e) => updateTaskField(task.id, "riskLevel", e.target.value)}
                    className="table-input"
                    style={{ color: getRiskColor(task.riskLevel), fontWeight: "bold" }}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderWBSView = () => {
    let lineCounter = 0;

    const renderNode = (node, depth = 0) => {
      lineCounter += 1;
      const currentLineNum = lineCounter;
      const isExpanded = expandedNodes.has(node.id);
      const hasChildren = !!(node.children?.length);

      const levelColors = { 1: "#2563eb", 2: "#10b981", 3: "#f59e0b", 4: "#8b5cf6" };
      const borderColor = levelColors[node.level] || "#6b7280";
      const bgColor = node.level === 1 ? "#f8fafc" : "white";

      return (
        <div key={node.id} style={{ marginBottom: "0.75rem" }}>
          <div
            className={`wbs-node-simple level-${node.level}`}
            style={{
              marginLeft: `${depth * 2}rem`,
              borderLeft: `4px solid ${borderColor}`,
              background: bgColor,
              borderRadius: "0.75rem",
              border: "2px solid #e5e7eb",
              padding: "1rem",
            }}
            
          >
            
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <button
                onClick={() => hasChildren && toggleNodeExpansion(node.id)}
                style={{
                  background: hasChildren ? "#f3f4f6" : "transparent",
                  border: "none",
                  cursor: hasChildren ? "pointer" : "default",
                  padding: "0.25rem",
                  borderRadius: "0.25rem",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  visibility: hasChildren ? "visible" : "hidden",
                }}
              >
                {hasChildren && (isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />)}
              </button>

              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#9ca3af", minWidth: "2rem", textAlign: "right" }}>
                  {currentLineNum}
                </span>
                <span style={{ fontFamily: "monospace", fontWeight: 700, color: borderColor, minWidth: "3rem" }}>
                  {node.id}
                </span>
                <span style={{ fontWeight: node.level === 1 ? 800 : 600, fontSize: node.level === 1 ? "1.125rem" : "1rem" }}>
                  {node.name}
                </span>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <span style={{ padding: "0.25rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 700, color: "white", background: getStatusColor(node.status) }}>
                  {node.status}
                </span>
                <span style={{ padding: "0.25rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: 700, color: "white", background: getPriorityColor(node.priority) }}>
                  {node.priority}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "0.75rem", paddingLeft: "3.25rem", fontSize: "0.875rem", color: "#6b7280" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <Calendar size={14} /> {node.startDate} → {node.endDate}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <Clock size={14} /> {node.duration} days
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <Users size={14} /> {node.resources}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <DollarSign size={14} /> ${node.cost?.toLocaleString?.() || 0}
              </span>
            </div>

            <div style={{ marginTop: "0.75rem", marginLeft: "3.25rem", background: "#f3f4f6", borderRadius: "0.5rem", height: "6px", overflow: "hidden" }}>
              <div style={{ width: `${node.progress}%`, height: "100%", background: getStatusColor(node.status) }} />
            </div>

            {node.notes && (
              <div style={{ marginTop: "0.75rem", marginLeft: "3.25rem", padding: "0.75rem", background: "#fffbeb", border: "1px solid #fde047", borderRadius: "0.375rem", color: "#78350f" }}>
                📝 {node.notes}
              </div>
            )}
          </div>

          {isExpanded && hasChildren && (
            <div style={{ marginTop: "0.5rem", marginLeft: `${depth * 2 + 1}rem`, borderLeft: `2px solid ${borderColor}20`, paddingLeft: "1rem" }}>
              {node.children.map((child) => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    };


    return (
      <div className="wbs-view">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", padding: "1rem", background: "white", borderRadius: "0.75rem", border: "2px solid #e5e7eb" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#111827" }}>
              Work Breakdown Structure
            </h3>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#6b7280" }}>
              Hierarchical view of all project tasks and phases
            </p>
          </div>
          <button
            onClick={() => setExpandedNodes(expandAllNodes(currentProject.wbs))}
            style={{ padding: "0.5rem 1rem", background: "#f3f4f6", border: "2px solid #e5e7eb", borderRadius: "0.5rem", cursor: "pointer", fontWeight: 700 }}
          >
            Expand All
          </button>
        </div>
        {currentProject.wbs.map((t) => renderNode(t, 0))}
      </div>
    );
  };

  // ===== Resource Center View =====
  // ===== Resources CRUD =====
const addResource = () => {
  const next = {
    resourceId: `R-${Date.now()}`,
    resourceName: "",
    type: "Labor",
    costUnit: "hour",
    unitPrice: 0,
  };

  const updated = {
    ...currentProject,
    resources: [...(currentProject?.resources || []), next],
    lastModified: new Date().toISOString(),
  };

  setCurrentProject(updated);
  saveProject(updated);
};

const updateResourceField = (index, field, value) => {
  const updatedResources = (currentProject?.resources || []).map((r, i) =>
    i === index ? { ...r, [field]: value } : r
  );

  const updated = {
    ...currentProject,
    resources: updatedResources,
    lastModified: new Date().toISOString(),
  };

  setCurrentProject(updated);
  saveProject(updated);
};

const deleteResource = (index) => {
  const updatedResources = (currentProject?.resources || []).filter((_, i) => i !== index);

  const updated = {
    ...currentProject,
    resources: updatedResources,
    lastModified: new Date().toISOString(),
  };

  setCurrentProject(updated);
  saveProject(updated);
};

  const renderResourcesView = () => {
  const resourcesList = currentProject?.resources || [];

  return (
    <div className="resources-view" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0 }}>Resource Center</h3>

        <button onClick={addResource} className="btn-add">
          <Plus size={16} /> Add Resource
        </button>
      </div>

      <table className="table-view">
        <thead>
          <tr>
            <th>Resource ID</th>
            <th>Resource Name</th>
            <th>Type</th>
            <th>Cost Unit</th>
            <th>Unit Price</th>
            <th style={{ width: 80 }}>Action</th>
          </tr>
        </thead>

        <tbody>
          {resourcesList.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: "1rem", color: "#6b7280" }}>
                No resources yet. Click <b>Add Resource</b>.
              </td>
            </tr>
          ) : (
            resourcesList.map((r, idx) => (
              <tr key={r.resourceId || idx}>
                <td>
                  <input
                    className="table-input"
                    value={r.resourceId || ""}
                    onChange={(e) => updateResourceField(idx, "resourceId", e.target.value)}
                  />
                </td>

                <td>
                  <input
                    className="table-input"
                    value={r.resourceName || ""}
                    onChange={(e) => updateResourceField(idx, "resourceName", e.target.value)}
                    placeholder="e.g., Electrician"
                  />
                </td>

                <td>
                  <select
                    className="table-input"
                    value={r.type || "labor"}
                    onChange={(e) => updateResourceField(idx, "type", e.target.value)}
                  >
                    <option value="labor">labor</option>
                    <option value="material">material</option>
                    <option value="equipment">equipment</option>
                    <option value="cost">cost</option>
                  </select>
                </td>

                <td>
                  <select
                    className="table-input"
                    value={r.costUnit || "hour"}
                    onChange={(e) => updateResourceField(idx, "costUnit", e.target.value)}
                  >
                    <option value="hour">hour</option>
                    <option value="day">day</option>
                    <option value="week">week</option>
                    <option value="month">month</option>
                    <option value="year">year</option>
                  </select>
                </td>

                <td>
                  <input
                    className="table-input"
                    type="number"
                    value={Number(r.unitPrice || 0)}
                    onChange={(e) => updateResourceField(idx, "unitPrice", Number(e.target.value || 0))}
                    min="0"
                  />
                </td>

                <td>
                  
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};


  // ===== Chat Panel =====
  const ChatHistoryPanel = () => {
    const [chatInput, setChatInput] = useState("");
    const [isSending, setIsSending] = useState(false);

    const sendMessage = async () => {
      if (!chatInput.trim() || isSending || !currentProject) return;
      setIsSending(true);
      const command = chatInput.trim();
      setChatInput("");

      try {
        setAiCommand(command);
        setTimeout(() => {
          processAICommand().finally(() => setIsSending(false));
        }, 50);
      } catch (e) {
        alert("Error sending: " + e.message);
        setIsSending(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };

    const copyPrompt = (prompt) => {
      navigator.clipboard.writeText(prompt);
      setCopiedPromptId(prompt);
      setTimeout(() => setCopiedPromptId(null), 2000);
    };

    const formatTime = (ts) => {
      try {
        return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      } catch {
        return "";
      }
    };

    const history = currentProject?.conversationHistory || [];

    return (
      <div
        className={`chat-panel ${showChatHistory ? "open" : ""}`}
        style={{
          position: "fixed",
          top: 0,
          right: showChatHistory ? 0 : "-420px",
          width: "420px",
          height: "100vh",
          zIndex: 999999,
        }}
      >
        <div className="chat-panel-header">
          <div className="chat-header-content">
            <div className="nilo-avatar">🤖</div>
            <div>
              <h3>Chat with Nilo</h3>
              <span className="chat-subtitle">
                {history.length} conversation{history.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <button className="btn-icon" onClick={() => setShowChatHistory(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="chat-messages">
          {history.length === 0 ? (
            <div className="chat-empty">
              <div className="nilo-avatar-large">🤖</div>
              <h4>Hi! I'm Nilo</h4>
              <p>Ask me to update your project.</p>
            </div>
          ) : (
            history.map((entry, index) => {
              const promptNum = index + 1;
              return (
                <div key={entry.id || index} className="message-group">
                  <div className="message-container user">
                    <div className="message-bubble user-bubble">
                      <div className="message-header">
                        <span className="message-number">#{promptNum}</span>
                        <span className="message-time">{formatTime(entry.timestamp)}</span>
                      </div>
                      <div className="message-content">{entry.userPrompt}</div>
                      <button className="copy-message-btn" onClick={() => copyPrompt(entry.userPrompt)} title="Copy prompt">
                        {copiedPromptId === entry.userPrompt ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                    <div className="message-avatar user-avatar">👤</div>
                  </div>

                  <div className="message-container nilo">
                    <div className="message-avatar nilo-avatar">🤖</div>
                    <div className="message-bubble nilo-bubble">
                      <div className="message-header">
                        <span className="nilo-name">Nilo</span>
                        <span className="message-time">{formatTime(entry.timestamp)}</span>
                      </div>
                      <div className="message-content">{entry.aiResponse}</div>
                      {entry.tasksModified > 0 && (
                        <div className="message-badge">
                          <CheckCircle size={12} />
                          {entry.tasksModified} task{entry.tasksModified !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="chat-input-area">
          <div className="chat-input-container">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Nilo... (e.g., Add testing phase)"
              className="chat-textarea"
              rows="1"
              disabled={isSending}
            />
            <button onClick={sendMessage} className="chat-send-btn" disabled={!chatInput.trim() || isSending}>
              {isSending ? <Loader2 className="spinner" size={20} /> : <Sparkles size={20} />}
            </button>
          </div>
          <div className="chat-hints">
            <span>💡 Try: "mark all complete"</span>
          </div>
        </div>
      </div>
    );
  };

  // ===== Loading / Auth screens =====
  if (authLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <Loader2 size={48} className="spin" style={{ margin: "0 auto" }} />
          <p style={{ marginTop: "1rem", fontSize: "1.125rem" }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <div className="logo">
              <Sparkles size={32} />
              <div className="logo-text">
                <h1>AI Project Scheduler</h1>
                <span className="tagline">Intelligent Project Planning</span>
              </div>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
          <div style={{ background: "white", padding: "3rem", borderRadius: "1rem", boxShadow: "0 20px 50px rgba(0,0,0,0.15)", textAlign: "center", maxWidth: "520px", width: "100%" }}>
            <h2 style={{ fontSize: "2rem", marginBottom: "0.75rem", color: "#111827", fontWeight: 800 }}>
              Welcome Back!
            </h2>
            <p style={{ color: "#6b7280", marginBottom: "2rem", fontSize: "1.125rem" }}>
              Sign in to access your projects.
            </p>

            <button
              onClick={signInWithGoogle}
              style={{
                width: "100%",
                padding: "1rem",
                background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
                color: "white",
                border: "none",
                borderRadius: "0.75rem",
                fontSize: "1.125rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
              }}
            >
              Sign in with Google
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ===== Main UI =====
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo">
              <Sparkles size={32} />
              <div className="logo-text">
                <h1>AI Project Scheduler</h1>
                <span className="tagline">Intelligent Project Planning</span>
              </div>
            </div>

            {currentProject && (
              <div className="project-info-header">
                <div className="project-name-large">{currentProject.name}</div>
                <div className="project-meta">
                  <span><Calendar size={14} /> {currentProject.projectStart}</span>
                  <span><DollarSign size={14} /> ${currentProject.projectBudget?.toLocaleString?.() || 0}</span>
                  <span><Users size={14} /> {currentProject.projectManager}</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 1rem", background: "rgba(255,255,255,0.1)", borderRadius: "0.5rem" }}>
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  referrerPolicy="no-referrer"
                  style={{ width: "32px", height: "32px", borderRadius: "50%", border: "2px solid white" }}
                />
              )}
              <span style={{ color: "white", fontSize: "0.875rem", fontWeight: 600 }}>
                {user.displayName || user.email}
              </span>
            </div>

            <button
              onClick={signOutUser}
              style={{
                padding: "0.75rem 1.25rem",
                background: "rgba(255,255,255,0.2)",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {currentProject && showFilters && (
        <div style={{ background: "white", borderBottom: "2px solid #e5e7eb", padding: "1.5rem 2rem" }}>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "250px", position: "relative" }}>
              <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#6b7280" }} />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", border: "2px solid #e5e7eb", borderRadius: "0.5rem" }}
              />
            </div>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "0.625rem 1rem", border: "2px solid #e5e7eb", borderRadius: "0.5rem", fontWeight: 700 }}>
              <option value="all">All Statuses</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
              <option value="Blocked">Blocked</option>
            </select>

            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={{ padding: "0.625rem 1rem", border: "2px solid #e5e7eb", borderRadius: "0.5rem", fontWeight: 700 }}>
              <option value="all">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            {(searchQuery || statusFilter !== "all" || priorityFilter !== "all") && (
              <button onClick={clearFilters} style={{ padding: "0.625rem 1rem", background: "#f3f4f6", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <X size={16} /> Clear
              </button>
            )}
          </div>

          {/* stats blocks kept as-is (your code) */}
          {projectStats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
              <div className="stat-card-small" onClick={() => handleStatusClick("all")} style={{ cursor: "pointer" }}>
                <BarChart3 size={20} style={{ color: "#3b82f6" }} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 800 }}>Total</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 900 }}>{projectStats.totalTasks}</div>
                </div>
              </div>

              <div className="stat-card-small" onClick={() => handleStatusClick("Completed")} style={{ cursor: "pointer" }}>
                <CheckCircle size={20} style={{ color: "#10b981" }} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 800 }}>Completed</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#10b981" }}>{projectStats.completedTasks}</div>
                </div>
              </div>

              <div className="stat-card-small" onClick={() => handleStatusClick("In Progress")} style={{ cursor: "pointer" }}>
                <Play size={20} style={{ color: "#3b82f6" }} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 800 }}>In Progress</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#3b82f6" }}>{projectStats.inProgressTasks}</div>
                </div>
              </div>

              <div className="stat-card-small" onClick={() => handleStatusClick("Not Started")} style={{ cursor: "pointer" }}>
                <Pause size={20} style={{ color: "#6b7280" }} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 800 }}>Not Started</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#6b7280" }}>{projectStats.notStartedTasks}</div>
                </div>
              </div>

              {projectStats.blockedTasks > 0 && (
                <div className="stat-card-small" onClick={() => handleStatusClick("Blocked")} style={{ cursor: "pointer" }}>
                  <AlertTriangle size={20} style={{ color: "#ef4444" }} />
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 800 }}>Blocked</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#ef4444" }}>{projectStats.blockedTasks}</div>
                  </div>
                </div>
              )}

              <div className="stat-card-small" onClick={() => handlePriorityClick("High")} style={{ cursor: "pointer" }}>
                <AlertTriangle size={20} style={{ color: "#ef4444" }} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 800 }}>High Priority</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#ef4444" }}>{projectStats.highPriorityTasks}</div>
                </div>
              </div>

              <div className="stat-card-small">
                <TrendingUp size={20} style={{ color: "#8b5cf6" }} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 800 }}>Avg Progress</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#8b5cf6" }}>{projectStats.avgProgress}%</div>
                </div>
              </div>

              <div className="stat-card-small">
                <DollarSign size={20} style={{ color: "#f59e0b" }} />
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 800 }}>Cost</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#f59e0b" }}>
                    ${(projectStats.totalCost / 1000).toFixed(0)}k
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {currentProject && (
        <div className="toolbar">
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <div className="view-buttons">
              <button onClick={() => setViewMode("gantt")} className={`btn-view ${viewMode === "gantt" ? "active" : ""}`}>
                <BarChart3 size={16} /> Gantt
              </button>
              <button onClick={() => setViewMode("table")} className={`btn-view ${viewMode === "table" ? "active" : ""}`}>
                <Table2 size={16} /> Table
              </button>
              <button onClick={() => setViewMode("wbs")} className={`btn-view ${viewMode === "wbs" ? "active" : ""}`}>
                <Grid3x3 size={16} /> WBS
              </button>
              <button
  onClick={() => setViewMode("resources")}
  className={`btn-view ${viewMode === "resources" ? "active" : ""}`}
>
  <Users size={16} /> Resources
</button>

            </div>

            <button onClick={() => setShowAddTaskModal(true)} className="btn-add" style={{ marginLeft: "0.5rem" }}>
              <Plus size={16} /> Add Task
            </button>

            <button onClick={() => setShowChatHistory((s) => !s)} className="btn-nilo" style={{ marginLeft: "0.5rem", position: "relative" }}>
              <MessageSquare size={18} />
              <span>Chat with Nilo</span>
              {currentProject?.conversationHistory?.length > 0 && (
                <span className="nilo-badge">{currentProject.conversationHistory.length}</span>
              )}
            </button>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {/* ✅ PRINT GROUP (separated) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                paddingRight: "1rem",
                marginRight: "0.75rem",
                borderRight: "2px solid #e5e7eb",
              }}
            >
              <button onClick={handlePrint} className="btn-view">
                Print
              </button>
            </div>

            {/* ✅ ZOOM ONLY FOR GANTT */}
            {viewMode === "gantt" && (
              <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                <button onClick={() => handleZoom("in")} title="Zoom In">
                  <ZoomIn size={18} />
                </button>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 1rem",
                    background: "white",
                    borderRadius: "0.5rem",
                    border: "2px solid #e5e7eb",
                    fontSize: "0.875rem",
                    fontWeight: 800,
                    minWidth: "140px",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ textTransform: "capitalize" }}>{timeScale}</span>
                  <span style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                    ({(ganttZoom * 100).toFixed(0)}%)
                  </span>
                </div>

                <button onClick={() => handleZoom("out")} title="Zoom Out">
                  <ZoomOut size={18} />
                </button>
              </div>
            )}

            <button onClick={() => setShowFilters((s) => !s)} className={`btn-view ${showFilters ? "active" : ""}`}>
              <Filter size={16} /> Filters
            </button>

            <button onClick={() => setCurrentProject(null)} className="btn-close">
              Close Project
            </button>
          </div>
        </div>
      )}

      <main className={`main-content ${showChatHistory ? "chat-open" : ""}`}>
        {!currentProject ? (
          <div className="project-setup">
            <div className="setup-card">
              <div className="setup-header">
                <Sparkles className="sparkle-icon" size={48} />
                <div>
                  <h2>Create Your Project Plan</h2>
                  <p className="setup-subtitle">Choose a template or describe your project and let AI create a plan</p>
                </div>
              </div>

              <div className="templates">
                <h3>🚀 Quick Start Templates</h3>
                <div className="template-grid">
                  <button onClick={() => createTemplateProject("software")} className="template-btn">
                    <div className="template-icon">💻</div>
                    <div className="template-title">E-Commerce Mobile App</div>
                    <div className="template-desc">Full lifecycle with phases</div>
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: "2rem" }}>
                <label>Or Create Custom Project with AI</label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Describe your project..."
                  rows="4"
                />
              </div>

              <button onClick={generateWBS} disabled={isGenerating || !projectDescription.trim()} className="btn-generate">
                {isGenerating ? (
                  <>
                    <Loader2 className="spin" size={22} /> AI is creating your project...
                  </>
                ) : (
                  <>
                    <Sparkles size={22} /> Generate Custom Project with AI
                  </>
                )}
              </button>

              {projects.length > 0 && (
                <div className="projects-list">
                  <h3>📁 Your Projects ({projects.length})</h3>
                  <div className="projects-grid">
                    {projects.map((p) => (
                      <div key={p.id} className="project-card">
                        <div className="project-card-header">
                          <h4>{p.name}</h4>
                          <span className="project-badge">{p.wbs?.length || 0} Phases</span>
                        </div>
                        <p className="project-description">{p.description}</p>
                        <div className="project-card-footer">
                          <div className="project-meta-small">
                            <span><Calendar size={14} /> {new Date(p.createdAt).toLocaleDateString()}</span>
                            {!!p.projectBudget && <span><DollarSign size={14} /> ${p.projectBudget.toLocaleString()}</span>}
                          </div>
                          <div className="project-actions">
                            <button
                              onClick={() => {
                                setCurrentProject(p);
                                setExpandedNodes(expandAllNodes(p.wbs));
                              }}
                              className="btn-open"
                            >
                              Open Project
                            </button>
                            <button onClick={() => deleteProject(p.id)} className="btn-delete-icon">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="project-view">
            {viewMode === "gantt" && renderGanttView()}
            {viewMode === "table" && renderTableView()}
            {viewMode === "wbs" && renderWBSView()}
            {viewMode === "resources" && renderResourcesView()}
          </div>
        )}
      </main>

      {/* Add Task Modal */}
      {showAddTaskModal && currentProject && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: "600px" }}>
            <div className="modal-header">
              <h3>Add New Task/Phase</h3>
              <button onClick={() => setShowAddTaskModal(false)} className="modal-close">×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Parent Task (leave empty for new phase)</label>
                <select
                  value={newTask.parentId || ""}
                  onChange={(e) => setNewTask({ ...newTask, parentId: e.target.value || null })}
                  style={{ width: "100%", padding: "0.625rem", border: "2px solid #e5e7eb", borderRadius: "0.5rem" }}
                >
                  <option value="">-- New Phase --</option>
                  {getAllTasks(currentProject.wbs).map((t) => (
                    <option key={t.id} value={t.id}>
                      {`${" ".repeat((t.level - 1) * 2)}${t.id} ${t.name}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Task Name *</label>
                <input
                  type="text"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  placeholder="Enter task name"
                  style={{ width: "100%", padding: "0.625rem", border: "2px solid #e5e7eb", borderRadius: "0.5rem" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label>Duration (days)</label>
                  <input
                    type="number"
                    value={newTask.duration}
                    onChange={(e) => setNewTask({ ...newTask, duration: e.target.value })}
                    min="1"
                    style={{ width: "100%", padding: "0.625rem", border: "2px solid #e5e7eb", borderRadius: "0.5rem" }}
                  />
                </div>

                <div className="form-group">
                  <label>Cost ($)</label>
                  <input
                    type="number"
                    value={newTask.cost}
                    onChange={(e) => setNewTask({ ...newTask, cost: e.target.value })}
                    min="0"
                    style={{ width: "100%", padding: "0.625rem", border: "2px solid #e5e7eb", borderRadius: "0.5rem" }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Resources</label>
                <input
                  type="text"
                  value={newTask.resources}
                  onChange={(e) => setNewTask({ ...newTask, resources: e.target.value })}
                  placeholder="e.g., PM, Team Lead"
                  style={{ width: "100%", padding: "0.625rem", border: "2px solid #e5e7eb", borderRadius: "0.5rem" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    style={{ width: "100%", padding: "0.625rem", border: "2px solid #e5e7eb", borderRadius: "0.5rem" }}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={newTask.status}
                    onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                    style={{ width: "100%", padding: "0.625rem", border: "2px solid #e5e7eb", borderRadius: "0.5rem" }}
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Risk Level</label>
                  <select
                    value={newTask.riskLevel}
                    onChange={(e) => setNewTask({ ...newTask, riskLevel: e.target.value })}
                    style={{ width: "100%", padding: "0.625rem", border: "2px solid #e5e7eb", borderRadius: "0.5rem" }}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={newTask.notes}
                  onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows="3"
                  style={{ width: "100%", padding: "0.625rem", border: "2px solid #e5e7eb", borderRadius: "0.5rem" }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowAddTaskModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={addTaskManually} className="btn-primary">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {currentProject && <ChatHistoryPanel />}

      {/* Footer */}
      <div className="copyright-footer">© 2025 AI Project Scheduler</div>

      {/* Task popup */}
      {selectedTask && (
        <div
          onClick={() => setSelectedTask(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999998,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "560px",
              maxWidth: "92vw",
              background: "white",
              borderRadius: "1rem",
              border: "2px solid #e5e7eb",
              padding: "1.25rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{selectedTask.name}</h3>
              <button onClick={() => setSelectedTask(null)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <X />
              </button>
            </div>

            <div style={{ marginTop: "0.75rem", color: "#374151", display: "grid", gap: "0.5rem" }}>
              <div><b>WBS:</b> {selectedTask.id}</div>
              <div><b>Status:</b> {selectedTask.status}</div>
              <div><b>Priority:</b> {selectedTask.priority}</div>
              <div><b>Dates:</b> {selectedTask.startDate} → {selectedTask.endDate}</div>
              <div><b>Progress:</b> {selectedTask.progress}%</div>
              <div><b>Resources:</b> {selectedTask.resources}</div>
              <div><b>Cost:</b> ${selectedTask.cost || 0}</div>
              {selectedTask.notes && <div><b>Notes:</b> {selectedTask.notes}</div>}
            </div>

            <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setAiCommand(`Update task ${selectedTask.id}: mark as In Progress, progress 25%`);
                  setTimeout(() => processAICommand(), 50);
                }}
                disabled={isProcessingCommand}
                style={{ padding: "0.6rem 0.9rem", borderRadius: "0.5rem", border: "2px solid #e5e7eb", background: "#f3f4f6", cursor: "pointer", fontWeight: 700 }}
              >
                {isProcessingCommand ? "..." : "Quick Update (AI)"}
              </button>

              <button
                onClick={() => setSelectedTask(null)}
                style={{ padding: "0.6rem 0.9rem", borderRadius: "0.5rem", border: "none", background: "#2563eb", color: "white", cursor: "pointer", fontWeight: 800 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

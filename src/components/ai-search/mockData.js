// Realistic mock data and helper functions for Nexora AI Search

export const MOCK_DRIVES = [
  { id: "all", label: "All Drives", icon: "💾" },
  { id: "C:", label: "C: (System)", icon: "💽", free: "84 GB free" },
  { id: "D:", label: "D: (Data)", icon: "💽", free: "320 GB free" },
  { id: "E:", label: "E: (Media)", icon: "💽", free: "512 GB free" },
  { id: "F:", label: "F: (Backup)", icon: "💽", free: "1.2 TB free" },
];

export const SUGGESTED_KEYWORDS = [
  "birthday",
  "college",
  "cybersecurity",
  "project",
  "invoice",
  "photos",
  "music",
  "videos",
  "documents",
  "resume",
  "meeting",
  "notes",
];

export const POPULAR_KEYWORDS = [
  "Project",
  "Vacation",
  "Invoice",
  "Code",
  "School",
  "Personal",
  "Work",
  "Music",
  "Photos",
];

export const FILE_TYPE_OPTIONS = [
  { id: "all", label: "All", icon: "📁", exts: "All file types" },
  { id: "documents", label: "Documents", icon: "📄", exts: "PDF, DOCX, TXT, XLSX, PPTX" },
  { id: "images", label: "Images", icon: "🖼️", exts: "JPG, PNG, GIF, WEBP, SVG" },
  { id: "videos", label: "Videos", icon: "🎬", exts: "MP4, MKV, AVI, MOV, WEBM" },
  { id: "audio", label: "Audio", icon: "🎵", exts: "MP3, WAV, FLAC, AAC, M4A" },
];

export const SAMPLE_QUERIES = [
  { text: "birthday photos", category: "images" },
  { text: "college PDFs", category: "documents" },
  { text: "cybersecurity videos", category: "videos" },
  { text: "my project files", category: "all" },
  { text: "mere birthday wali photos do", category: "images" },
  { text: "college ki cybersecurity wali PDFs do", category: "documents" },
  { text: "jisme boy hai wo photos do", category: "images" },
  { text: "D drive ki project files do", category: "all" },
];

export const MOCK_SEARCH_DATABASE = [
  {
    id: "f1",
    name: "birthday_party_2025.jpg",
    path: "D:\\Pictures\\Birthday\\",
    fullPath: "D:\\Pictures\\Birthday\\birthday_party_2025.jpg",
    type: "images",
    ext: "JPG",
    size: "4.8 MB",
    sizeBytes: 5033164,
    date: "12 Aug 2025",
    tags: ["Birthday", "People", "Cake", "Celebration", "Party"],
    score: "99% match",
    summary: "High resolution photo containing birthday cake with candles, smiling people and party decorations.",
    drive: "D:"
  },
  {
    id: "f2",
    name: "Cybersecurity_Notes.pdf",
    path: "D:\\College\\Cybersecurity\\",
    fullPath: "D:\\College\\Cybersecurity\\Cybersecurity_Notes.pdf",
    type: "documents",
    ext: "PDF",
    size: "12 MB",
    sizeBytes: 12582912,
    date: "18 Sep 2025",
    tags: ["Cybersecurity", "Network", "Security", "College", "Encryption"],
    score: "98% match",
    summary: "Lecture notes covering public key cryptography, zero trust network architecture, and ethical hacking fundamentals.",
    drive: "D:"
  },
  {
    id: "f3",
    name: "Cybersecurity_Lecture.mp4",
    path: "D:\\Videos\\Courses\\",
    fullPath: "D:\\Videos\\Courses\\Cybersecurity_Lecture.mp4",
    type: "videos",
    ext: "MP4",
    size: "1.2 GB",
    sizeBytes: 1288490188,
    date: "04 Oct 2025",
    tags: ["Cybersecurity", "Networking", "Ethical Hacking", "Video Lecture"],
    score: "96% match",
    summary: "Recorded classroom lecture on penetration testing methodologies and defensive perimeter setup.",
    drive: "D:"
  },
  {
    id: "f4",
    name: "Study_Music.mp3",
    path: "D:\\Music\\Study\\",
    fullPath: "D:\\Music\\Study\\Study_Music.mp3",
    type: "audio",
    ext: "MP3",
    size: "8 MB",
    sizeBytes: 8388608,
    date: "01 Nov 2025",
    tags: ["Music", "Instrumental", "Study", "Focus", "Lo-Fi"],
    score: "94% match",
    summary: "Calm instrumental lo-fi track optimized for long programming and study sessions.",
    drive: "D:"
  },
  {
    id: "f5",
    name: "College_Final_Project_Report.docx",
    path: "C:\\Users\\Suryw\\Documents\\Projects\\",
    fullPath: "C:\\Users\\Suryw\\Documents\\Projects\\College_Final_Project_Report.docx",
    type: "documents",
    ext: "DOCX",
    size: "3.4 MB",
    sizeBytes: 3565158,
    date: "15 Jan 2026",
    tags: ["College", "Project", "Report", "AI Explorer", "Documentation"],
    score: "97% match",
    summary: "Final year engineering project documentation with system architecture, benchmark comparisons and diagrams.",
    drive: "C:"
  },
  {
    id: "f6",
    name: "birthday_cake_celebration.png",
    path: "D:\\Pictures\\Birthday\\",
    fullPath: "D:\\Pictures\\Birthday\\birthday_cake_celebration.png",
    type: "images",
    ext: "PNG",
    size: "6.2 MB",
    sizeBytes: 6501171,
    date: "12 Aug 2025",
    tags: ["Birthday", "Cake", "Candles", "Family", "Boy"],
    score: "96% match",
    summary: "Close-up photograph of a chocolate birthday cake with lit candles and celebration balloons in background.",
    drive: "D:"
  },
  {
    id: "f7",
    name: "Invoice_September_2025.xlsx",
    path: "D:\\Work\\Invoices\\",
    fullPath: "D:\\Work\\Invoices\\Invoice_September_2025.xlsx",
    type: "documents",
    ext: "XLSX",
    size: "540 KB",
    sizeBytes: 552960,
    date: "30 Sep 2025",
    tags: ["Invoice", "Work", "Billing", "Finance", "Accounting"],
    score: "93% match",
    summary: "Monthly billing summary sheet with tax calculations, client itemized deliverables, and wire transfer receipts.",
    drive: "D:"
  },
  {
    id: "f8",
    name: "boy_college_campus_portrait.jpg",
    path: "D:\\Pictures\\College\\",
    fullPath: "D:\\Pictures\\College\\boy_college_campus_portrait.jpg",
    type: "images",
    ext: "JPG",
    size: "3.9 MB",
    sizeBytes: 4089446,
    date: "22 Mar 2025",
    tags: ["College", "Portrait", "Boy", "Campus", "Friends"],
    score: "95% match",
    summary: "Outdoor daylight portrait of a college student holding a backpack on university campus grounds.",
    drive: "D:"
  },
  {
    id: "f9",
    name: "Resume_Software_Engineer_2026.pdf",
    path: "C:\\Users\\Suryw\\Documents\\Career\\",
    fullPath: "C:\\Users\\Suryw\\Documents\\Career\\Resume_Software_Engineer_2026.pdf",
    type: "documents",
    ext: "PDF",
    size: "280 KB",
    sizeBytes: 286720,
    date: "10 Feb 2026",
    tags: ["Resume", "Career", "Software", "CV", "Skills"],
    score: "97% match",
    summary: "Updated 1-page professional resume detailing full stack skills, Electron desktop development, and AI integration projects.",
    drive: "C:"
  },
  {
    id: "f10",
    name: "Project_Presentation_Demo.mp4",
    path: "E:\\Videos\\Projects\\",
    fullPath: "E:\\Videos\\Projects\\Project_Presentation_Demo.mp4",
    type: "videos",
    ext: "MP4",
    size: "850 MB",
    sizeBytes: 891289600,
    date: "28 Nov 2025",
    tags: ["Project", "Presentation", "Demo", "College", "Tech"],
    score: "92% match",
    summary: "10-minute screen recording demonstrating file manager neural search UI and instant query benchmark results.",
    drive: "E:"
  },
  {
    id: "f11",
    name: "Meeting_Audio_Notes_Project.m4a",
    path: "D:\\Audio\\Recordings\\",
    fullPath: "D:\\Audio\\Recordings\\Meeting_Audio_Notes_Project.m4a",
    type: "audio",
    ext: "M4A",
    size: "18 MB",
    sizeBytes: 18874368,
    date: "05 Dec 2025",
    tags: ["Meeting", "Audio", "Notes", "Project", "Discussion"],
    score: "91% match",
    summary: "Voice recording transcript of sprint planning meeting for upcoming cloud sync release.",
    drive: "D:"
  },
  {
    id: "f12",
    name: "vacation_family_trip_photos.zip",
    path: "E:\\Backups\\Vacation\\",
    fullPath: "E:\\Backups\\Vacation\\vacation_family_trip_photos.zip",
    type: "documents",
    ext: "ZIP",
    size: "3.1 GB",
    sizeBytes: 3328599654,
    date: "14 Jul 2025",
    tags: ["Vacation", "Photos", "Family", "Trip", "Archive"],
    score: "89% match",
    summary: "Compressed photo album archive with 450+ raw images from mountain hiking vacation.",
    drive: "E:"
  }
];

export function performMockSearch(query, fileType = "all", drive = "all") {
  const q = (query || "").trim().toLowerCase();
  
  // Special trigger for error demo
  if (q === "error" || q === "trigger_error") {
    return { status: "error", results: [] };
  }

  // If query is empty or just whitespace
  if (!q && fileType === "all" && drive === "all") {
    return { status: "empty", results: [] };
  }

  // Tokenize natural language query
  // Handles Hinglish / Natural language queries like "mere birthday wali photos do", "college ki cybersecurity wali PDFs do", "D drive ki project files do"
  const tokens = q
    .replace(/[?,.!"']/g, " ")
    .split(/\s+/)
    .filter(t => !["do", "ki", "wali", "mera", "mere", "meri", "hai", "wo", "jisme", "the", "a", "an", "of", "in", "about", "for", "with", "show", "give", "me", "find", "get"].includes(t));

  // Determine intent from query words
  let inferredType = fileType;
  if (fileType === "all") {
    if (q.includes("photo") || q.includes("image") || q.includes("picture") || q.includes("pic") || q.includes("jpg") || q.includes("png")) {
      inferredType = "images";
    } else if (q.includes("pdf") || q.includes("doc") || q.includes("notes") || q.includes("invoice") || q.includes("resume") || q.includes("sheet") || q.includes("report")) {
      inferredType = "documents";
    } else if (q.includes("video") || q.includes("lecture") || q.includes("movie") || q.includes("clip") || q.includes("mp4")) {
      inferredType = "videos";
    } else if (q.includes("music") || q.includes("song") || q.includes("audio") || q.includes("mp3") || q.includes("recording")) {
      inferredType = "audio";
    }
  }

  let inferredDrive = drive;
  if (drive === "all") {
    if (q.includes("c:") || q.includes("c drive")) inferredDrive = "C:";
    else if (q.includes("d:") || q.includes("d drive")) inferredDrive = "D:";
    else if (q.includes("e:") || q.includes("e drive")) inferredDrive = "E:";
    else if (q.includes("f:") || q.includes("f drive")) inferredDrive = "F:";
  }

  const results = MOCK_SEARCH_DATABASE.filter(item => {
    // Filter by type if specified
    if (inferredType !== "all" && item.type !== inferredType) {
      if (q.includes("pdf") && item.ext === "PDF") {
        // keep
      } else {
        return false;
      }
    }

    // Filter by drive if specified
    if (inferredDrive !== "all" && item.drive !== inferredDrive) {
      return false;
    }

    // If no query tokens remain, return true based on filter
    if (tokens.length === 0) return true;

    // Check if any token matches filename, tags, summary, ext, or path
    const searchableText = `${item.name} ${item.tags.join(" ")} ${item.summary} ${item.path} ${item.ext} ${item.type}`.toLowerCase();
    
    return tokens.some(tok => searchableText.includes(tok));
  });

  if (results.length === 0) {
    return { status: "no-results", results: [] };
  }

  return { status: "results", results };
}

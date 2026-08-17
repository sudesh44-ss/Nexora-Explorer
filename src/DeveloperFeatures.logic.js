/* =========================================================
   DEVELOPER FEATURES - LOGIC
   ========================================================= */


/* =========================================================
   1. TERMINAL
   ========================================================= */

/*
  Terminal configuration.
  Actual CMD / PowerShell launch baad mein
  Electron/Node side se connect hoga.
*/

export const terminalTypes = [
  "CMD",
  "PowerShell",
  "Windows Terminal",
];

export function getTerminalConfig(type) {
  const configs = {
    CMD: {
      name: "CMD",
      executable: "cmd.exe",
      shell: true,
    },

    PowerShell: {
      name: "PowerShell",
      executable: "powershell.exe",
      shell: true,
    },

    "Windows Terminal": {
      name: "Windows Terminal",
      executable: "wt.exe",
      shell: true,
    },
  };

  return configs[type] || configs.PowerShell;
}


/*
  Current folder validate karne ke liye.
*/

export function validateWorkingDirectory(path) {
  if (!path || typeof path !== "string") {
    return {
      valid: false,
      message: "Working directory is required.",
    };
  }

  return {
    valid: true,
    path: path.trim(),
  };
}


/* =========================================================
   2. GIT
   ========================================================= */

/*
  Git repository detect karne ke liye.

  Actual filesystem check Electron/Node mein hoga.
  Abhi function expected structure define karta hai.
*/

export function createGitRepositoryInfo({
  isRepository = false,
  path = "",
  branch = null,
} = {}) {
  return {
    isRepository,
    path,
    branch,
    modified: 0,
    staged: 0,
    untracked: 0,
  };
}


/*
  Git status ko count karna.
*/

export function calculateGitStatus(files = []) {
  const result = {
    modified: 0,
    staged: 0,
    untracked: 0,
    deleted: 0,
    renamed: 0,
  };

  files.forEach((file) => {
    switch (file.status) {
      case "modified":
        result.modified++;
        break;

      case "staged":
        result.staged++;
        break;

      case "untracked":
        result.untracked++;
        break;

      case "deleted":
        result.deleted++;
        break;

      case "renamed":
        result.renamed++;
        break;

      default:
        break;
    }
  });

  return result;
}


/*
  Git branch validate karna.
*/

export function validateGitBranchName(branchName) {
  if (!branchName || typeof branchName !== "string") {
    return {
      valid: false,
      message: "Branch name is required.",
    };
  }

  const branch = branchName.trim();

  if (branch.length === 0) {
    return {
      valid: false,
      message: "Branch name cannot be empty.",
    };
  }

  /*
    Basic invalid characters.
  */

  const invalidCharacters = [
    " ",
    "~",
    "^",
    ":",
    "?",
    "*",
    "[",
    "\\",
  ];

  const hasInvalidCharacter = invalidCharacters.some(
    (character) => branch.includes(character)
  );

  if (hasInvalidCharacter) {
    return {
      valid: false,
      message: "Branch name contains invalid characters.",
    };
  }

  return {
    valid: true,
    branch,
  };
}


/*
  Git operation confirmation.

  Dangerous operations directly execute nahi honge.
*/

export function requiresGitConfirmation(operation) {
  const dangerousOperations = [
    "commit",
    "push",
    "pull",
    "reset",
    "checkout",
    "merge",
    "delete-branch",
  ];

  return dangerousOperations.includes(
    operation.toLowerCase()
  );
}


/* =========================================================
   3. FILE ENCODING
   ========================================================= */

/*
  Common encodings.
*/

export const supportedEncodings = [
  "UTF-8",
  "UTF-8 BOM",
  "UTF-16",
  "ASCII",
  "Windows-1252",
];


/*
  BOM detect karna.

  Browser / Node mein Uint8Array ke saath
  use kiya ja sakta hai.
*/

export function detectBOM(bytes) {
  if (!bytes || bytes.length < 2) {
    return {
      encoding: null,
      hasBOM: false,
    };
  }

  /*
    UTF-8 BOM
    EF BB BF
  */

  if (
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return {
      encoding: "UTF-8",
      hasBOM: true,
    };
  }


  /*
    UTF-16 LE
    FF FE
  */

  if (
    bytes[0] === 0xff &&
    bytes[1] === 0xfe
  ) {
    return {
      encoding: "UTF-16 LE",
      hasBOM: true,
    };
  }


  /*
    UTF-16 BE
    FE FF
  */

  if (
    bytes[0] === 0xfe &&
    bytes[1] === 0xff
  ) {
    return {
      encoding: "UTF-16 BE",
      hasBOM: true,
    };
  }


  return {
    encoding: null,
    hasBOM: false,
  };
}


/*
  Basic UTF-8 validation.
*/

export function isValidUTF8(bytes) {
  if (!bytes || !(bytes instanceof Uint8Array)) {
    return false;
  }

  let i = 0;

  while (i < bytes.length) {
    const byte = bytes[i];

    /*
      ASCII
    */

    if (byte <= 0x7f) {
      i++;
      continue;
    }


    /*
      2-byte sequence
    */

    if (
      byte >= 0xc2 &&
      byte <= 0xdf
    ) {
      if (i + 1 >= bytes.length) {
        return false;
      }

      const next = bytes[i + 1];

      if (
        next < 0x80 ||
        next > 0xbf
      ) {
        return false;
      }

      i += 2;
      continue;
    }


    /*
      3-byte sequence
    */

    if (
      byte >= 0xe0 &&
      byte <= 0xef
    ) {
      if (i + 2 >= bytes.length) {
        return false;
      }

      const byte2 = bytes[i + 1];
      const byte3 = bytes[i + 2];

      if (
        byte2 < 0x80 ||
        byte2 > 0xbf ||
        byte3 < 0x80 ||
        byte3 > 0xbf
      ) {
        return false;
      }

      i += 3;
      continue;
    }


    /*
      4-byte sequence
    */

    if (
      byte >= 0xf0 &&
      byte <= 0xf4
    ) {
      if (i + 3 >= bytes.length) {
        return false;
      }

      const byte2 = bytes[i + 1];
      const byte3 = bytes[i + 2];
      const byte4 = bytes[i + 3];

      if (
        byte2 < 0x80 ||
        byte2 > 0xbf ||
        byte3 < 0x80 ||
        byte3 > 0xbf ||
        byte4 < 0x80 ||
        byte4 > 0xbf
      ) {
        return false;
      }

      i += 4;
      continue;
    }


    return false;
  }

  return true;
}


/*
  Line ending detection.
*/

export function detectLineEnding(text) {
  if (typeof text !== "string") {
    return "Unknown";
  }

  if (text.includes("\r\n")) {
    return "CRLF";
  }

  if (text.includes("\n")) {
    return "LF";
  }

  if (text.includes("\r")) {
    return "CR";
  }

  return "None";
}


/* =========================================================
   4. HEX VIEWER
   ========================================================= */


/*
  Bytes ko hexadecimal string mein convert karna.
*/

export function bytesToHex(bytes) {
  if (!bytes || !(bytes instanceof Uint8Array)) {
    return "";
  }

  return Array.from(bytes)
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()
    )
    .join(" ");
}


/*
  Hex bytes ko ASCII representation mein convert karna.
*/

export function bytesToASCII(bytes) {
  if (!bytes || !(bytes instanceof Uint8Array)) {
    return "";
  }

  return Array.from(bytes)
    .map((byte) => {
      if (byte >= 32 && byte <= 126) {
        return String.fromCharCode(byte);
      }

      return ".";
    })
    .join("");
}


/*
  Hex viewer ke liye rows generate karna.
*/

export function generateHexRows(
  bytes,
  bytesPerRow = 16
) {
  if (
    !bytes ||
    !(bytes instanceof Uint8Array)
  ) {
    return [];
  }

  const rows = [];

  for (
    let offset = 0;
    offset < bytes.length;
    offset += bytesPerRow
  ) {
    const rowBytes = bytes.slice(
      offset,
      offset + bytesPerRow
    );

    rows.push({
      offset: offset
        .toString(16)
        .padStart(8, "0")
        .toUpperCase(),

      hex: bytesToHex(rowBytes),

      ascii: bytesToASCII(rowBytes),
    });
  }

  return rows;
}


/*
  Hex pattern search.

  Example:
  "FF D8 FF"
*/

export function searchHexPattern(
  bytes,
  pattern
) {
  if (
    !bytes ||
    !(bytes instanceof Uint8Array)
  ) {
    return [];
  }

  if (!pattern || typeof pattern !== "string") {
    return [];
  }

  const cleanPattern = pattern
    .replace(/[^0-9a-fA-F]/g, "")
    .toUpperCase();

  if (
    cleanPattern.length === 0 ||
    cleanPattern.length % 2 !== 0
  ) {
    return [];
  }

  const patternBytes = [];

  for (
    let i = 0;
    i < cleanPattern.length;
    i += 2
  ) {
    patternBytes.push(
      parseInt(
        cleanPattern.slice(i, i + 2),
        16
      )
    );
  }

  const results = [];

  for (
    let i = 0;
    i <= bytes.length - patternBytes.length;
    i++
  ) {
    let matched = true;

    for (
      let j = 0;
      j < patternBytes.length;
      j++
    ) {
      if (
        bytes[i + j] !== patternBytes[j]
      ) {
        matched = false;
        break;
      }
    }

    if (matched) {
      results.push(i);
    }
  }

  return results;
}


/* =========================================================
   5. JSON FORMATTER
   ========================================================= */


/*
  JSON validate.
*/

export function validateJSON(jsonText) {
  if (typeof jsonText !== "string") {
    return {
      valid: false,
      error: "JSON input must be text.",
    };
  }

  try {
    JSON.parse(jsonText);

    return {
      valid: true,
      error: null,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}


/*
  JSON format.
*/

export function formatJSON(
  jsonText,
  indentation = 2
) {
  try {
    const parsed = JSON.parse(jsonText);

    return {
      success: true,
      result: JSON.stringify(
        parsed,
        null,
        indentation
      ),
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      result: null,
      error: error.message,
    };
  }
}


/*
  JSON minify.
*/

export function minifyJSON(jsonText) {
  try {
    const parsed = JSON.parse(jsonText);

    return {
      success: true,
      result: JSON.stringify(parsed),
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      result: null,
      error: error.message,
    };
  }
}


/*
  JSON object ko tree structure mein convert karna.
*/

export function createJSONTree(
  value,
  key = "root"
) {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return {
      key,
      value,
      type: typeof value,
      children: [],
    };
  }

  const children = Object.entries(value).map(
    ([childKey, childValue]) =>
      createJSONTree(
        childValue,
        childKey
      )
  );

  return {
    key,
    value: null,
    type: Array.isArray(value)
      ? "array"
      : "object",
    children,
  };
}


/* =========================================================
   6. CODE FILE DETECTION
   ========================================================= */

export const codeExtensions = {
  javascript: [
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
  ],

  typescript: [
    ".ts",
    ".tsx",
  ],

  web: [
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".xml",
  ],

  python: [
    ".py",
  ],

  java: [
    ".java",
  ],

  c: [
    ".c",
    ".h",
  ],

  cpp: [
    ".cpp",
    ".hpp",
    ".cc",
  ],

  data: [
    ".json",
    ".yaml",
    ".yml",
    ".xml",
  ],

  markdown: [
    ".md",
  ],
};


/*
  File extension se language detect karna.
*/

export function detectCodeLanguage(fileName) {
  if (
    !fileName ||
    typeof fileName !== "string"
  ) {
    return "Unknown";
  }

  const lowerName =
    fileName.toLowerCase();

  const dotIndex =
    lowerName.lastIndexOf(".");

  if (dotIndex === -1) {
    return "Unknown";
  }

  const extension =
    lowerName.slice(dotIndex);

  for (
    const [language, extensions]
    of Object.entries(codeExtensions)
  ) {
    if (extensions.includes(extension)) {
      return language;
    }
  }

  return "Unknown";
}


/*
  Code file hai ya nahi.
*/

export function isCodeFile(fileName) {
  return (
    detectCodeLanguage(fileName) !==
    "Unknown"
  );
}


/* =========================================================
   7. FILE HASH
   ========================================================= */


/*
  Browser Web Crypto API se hash calculate karna.

  SHA-256 / SHA-1 browser mein supported hain.

  MD5/SHA-512 ke liye later Node/Electron
  ya dedicated crypto library use karenge.
*/

export async function calculateHash(
  data,
  algorithm = "SHA-256"
) {
  if (!data) {
    throw new Error(
      "Data is required for hash calculation."
    );
  }

  const supportedAlgorithms = [
    "SHA-1",
    "SHA-256",
    "SHA-384",
    "SHA-512",
  ];

  if (
    !supportedAlgorithms.includes(
      algorithm
    )
  ) {
    throw new Error(
      `${algorithm} is not supported by the browser Web Crypto API.`
    );
  }

  let buffer;

  if (data instanceof ArrayBuffer) {
    buffer = data;
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer;
  } else if (typeof data === "string") {
    buffer =
      new TextEncoder().encode(data).buffer;
  } else {
    throw new Error(
      "Unsupported data type."
    );
  }

  const hashBuffer =
    await crypto.subtle.digest(
      algorithm,
      buffer
    );

  const hashArray =
    Array.from(
      new Uint8Array(hashBuffer)
    );

  return hashArray
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("")
    .toUpperCase();
}


/*
  Hash compare.
*/

export function compareHashes(
  hash1,
  hash2
) {
  if (
    typeof hash1 !== "string" ||
    typeof hash2 !== "string"
  ) {
    return false;
  }

  return (
    hash1.trim().toUpperCase() ===
    hash2.trim().toUpperCase()
  );
}


/* =========================================================
   8. FILE METADATA
   ========================================================= */


/*
  Basic metadata object.

  Actual Windows metadata baad mein
  Electron/Node se collect hoga.
*/

export function createFileMetadata({
  name = "",
  path = "",
  size = 0,
  created = null,
  modified = null,
  accessed = null,
  extension = "",
  mimeType = "",
} = {}) {
  return {
    name,
    path,
    size,
    extension,
    mimeType,
    created,
    modified,
    accessed,

    system: {
      owner: null,
      permissions: null,
      hidden: false,
      readOnly: false,
      attributes: [],
    },

    media: {
      resolution: null,
      duration: null,
      codec: null,
      bitrate: null,
      fps: null,
    },

    image: {
      exif: null,
      camera: null,
      lens: null,
      iso: null,
      exposure: null,
      gps: null,
    },
  };
}


/*
  File size ko readable format mein convert karna.
*/

export function formatFileSize(bytes) {
  if (
    typeof bytes !== "number" ||
    bytes < 0
  ) {
    return "0 B";
  }

  if (bytes === 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
    "PB",
  ];

  const index = Math.floor(
    Math.log(bytes) /
      Math.log(1024)
  );

  const safeIndex = Math.min(
    index,
    units.length - 1
  );

  const value =
    bytes /
    Math.pow(1024, safeIndex);

  return `${value.toFixed(
    safeIndex === 0 ? 0 : 2
  )} ${units[safeIndex]}`;
}


/* =========================================================
   9. CONTEXT MENU
   ========================================================= */

export const developerContextActions = [
  {
    id: "open-terminal",
    label: "Open Terminal Here",
    dangerous: false,
  },

  {
    id: "open-powershell",
    label: "Open PowerShell",
    dangerous: false,
  },

  {
    id: "git-status",
    label: "Git Status",
    dangerous: false,
  },

  {
    id: "view-source",
    label: "View Source",
    dangerous: false,
  },

  {
    id: "json-formatter",
    label: "JSON Formatter",
    dangerous: false,
  },

  {
    id: "hex-viewer",
    label: "Hex Viewer",
    dangerous: false,
  },

  {
    id: "calculate-hash",
    label: "Calculate Hash",
    dangerous: false,
  },

  {
    id: "view-metadata",
    label: "View Metadata",
    dangerous: false,
  },

  {
    id: "delete",
    label: "Delete",
    dangerous: true,
  },
];


/*
  Dangerous action check.
*/

export function isDangerousDeveloperAction(
  actionId
) {
  const action =
    developerContextActions.find(
      (item) =>
        item.id === actionId
    );

  return action?.dangerous === true;
}


/* =========================================================
   10. DEVELOPER FILE TYPE
   ========================================================= */

export function getDeveloperFileType(
  fileName
) {
  if (!fileName) {
    return "unknown";
  }

  const extension =
    fileName
      .toLowerCase()
      .split(".")
      .pop();

  const typeMap = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",

    html: "html",
    css: "css",

    json: "json",
    xml: "xml",

    md: "markdown",

    py: "python",

    java: "java",

    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
  };

  return (
    typeMap[extension] ||
    "unknown"
  );
}


/* =========================================================
   11. SAFE FILE OPERATION CHECK
   ========================================================= */

/*
  Developer tools ke dangerous operations ko
  confirmation ke bina execute nahi karna.
*/

export function validateDeveloperOperation(
  operation
) {
  const dangerousOperations = [
    "delete",
    "overwrite",
    "modify",
    "commit",
    "push",
    "pull",
    "reset",
    "checkout",
    "merge",
    "convert",
  ];

  const normalized =
    String(operation)
      .toLowerCase()
      .trim();

  return {
    operation: normalized,

    dangerous:
      dangerousOperations.includes(
        normalized
      ),

    requiresConfirmation:
      dangerousOperations.includes(
        normalized
      ),
  };
}


/* =========================================================
   12. ERROR HANDLING
   ========================================================= */

export function createDeveloperError(
  type,
  message,
  details = null
) {
  return {
    success: false,

    error: {
      type,
      message,
      details,
      timestamp:
        new Date().toISOString(),
    },
  };
}


/* =========================================================
   13. SUCCESS RESPONSE
   ========================================================= */

export function createDeveloperSuccess(
  data = null
) {
  return {
    success: true,
    data,
    error: null,
    timestamp:
      new Date().toISOString(),
  };
}
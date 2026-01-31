// src/data/etherscan.ts
var BLOCKSCOUT_URLS = {
  ethereum: "https://eth.blockscout.com/api/v2",
  base: "https://base.blockscout.com/api/v2",
  arbitrum: "https://arbitrum.blockscout.com/api/v2",
  optimism: "https://optimism.blockscout.com/api/v2",
  polygon: "https://polygon.blockscout.com/api/v2"
};
async function getContractInfo(address, chain) {
  const baseUrl = BLOCKSCOUT_URLS[chain];
  const contractData = await fetchContractData(baseUrl, address);
  const addressData = await fetchAddressData(baseUrl, address);
  let ageDays = null;
  if (addressData.creation_tx_hash) {
    ageDays = await fetchContractAge(baseUrl, addressData.creation_tx_hash);
  }
  const isProxy = contractData.source_code ? /delegatecall|Proxy|implementation/i.test(contractData.source_code) : false;
  const hasSelfDestruct = contractData.source_code ? /selfdestruct|suicide/i.test(contractData.source_code) : false;
  return {
    verified: contractData.is_verified || contractData.is_partially_verified || false,
    sourceAvailable: Boolean(contractData.source_code),
    contractName: contractData.name,
    ageDays,
    txCount: null,
    // TODO: fetch tx count
    isProxy,
    isUpgradeable: isProxy,
    hasSelfDestruct,
    protocol: void 0
    // TODO: match known protocols
  };
}
async function fetchContractData(baseUrl, address) {
  try {
    const url = `${baseUrl}/smart-contracts/${address}`;
    const res = await fetch(url);
    if (!res.ok) {
      return {};
    }
    return await res.json();
  } catch {
    return {};
  }
}
async function fetchAddressData(baseUrl, address) {
  try {
    const url = `${baseUrl}/addresses/${address}`;
    const res = await fetch(url);
    if (!res.ok) {
      return {};
    }
    return await res.json();
  } catch {
    return {};
  }
}
async function fetchContractAge(baseUrl, txHash) {
  try {
    const url = `${baseUrl}/transactions/${txHash}`;
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    if (!data.timestamp) {
      return null;
    }
    const createdAt = new Date(data.timestamp).getTime();
    const now = Date.now();
    const ageDays = Math.floor((now - createdAt) / (1e3 * 60 * 60 * 24));
    return ageDays;
  } catch {
    return null;
  }
}

// src/core/scorer.ts
function calculateRiskScore(info) {
  let score = 0;
  const reasons = [];
  if (!info.verified) {
    score += 40;
    reasons.push("\u274C Unverified source code");
  } else {
    reasons.push("\u2713 Source code verified");
  }
  if (info.ageDays !== null) {
    if (info.ageDays < 7) {
      score += 30;
      reasons.push(`\u26A0\uFE0F Very new contract (${info.ageDays} days old)`);
    } else if (info.ageDays < 30) {
      score += 15;
      reasons.push(`\u26A0\uFE0F New contract (${info.ageDays} days old)`);
    } else if (info.ageDays < 90) {
      score += 5;
      reasons.push(`\u2713 Contract age: ${info.ageDays} days`);
    } else {
      reasons.push(`\u2713 Established contract (${info.ageDays} days old)`);
    }
  } else {
    score += 10;
    reasons.push("\u26A0\uFE0F Could not determine contract age");
  }
  if (info.txCount !== null) {
    if (info.txCount < 10) {
      score += 20;
      reasons.push(`\u26A0\uFE0F Very low activity (${info.txCount} txs)`);
    } else if (info.txCount < 100) {
      score += 10;
      reasons.push(`\u26A0\uFE0F Low activity (${info.txCount} txs)`);
    } else if (info.txCount < 1e3) {
      reasons.push(`\u2713 Moderate activity (${info.txCount} txs)`);
    } else {
      reasons.push(`\u2713 High activity (${info.txCount.toLocaleString()} txs)`);
    }
  }
  if (info.isProxy || info.isUpgradeable) {
    score += 15;
    reasons.push("\u26A0\uFE0F Proxy/upgradeable contract");
  }
  if (info.hasSelfDestruct) {
    score += 20;
    reasons.push("\u274C Contains selfdestruct");
  }
  if (info.protocol) {
    score = Math.max(0, score - 20);
    reasons.push(`\u2713 Known protocol: ${info.protocol}`);
  }
  return { score, reasons };
}
function scoreToLevel(score) {
  if (score <= 20) return "low";
  if (score <= 40) return "medium";
  if (score <= 60) return "high";
  return "critical";
}

// src/core/analyzer.ts
async function analyzeContract(address, options) {
  const { chain } = options;
  const info = await getContractInfo(address, chain);
  const { score, reasons } = calculateRiskScore(info);
  const riskLevel = scoreToLevel(score);
  return {
    address,
    chain,
    verified: info.verified,
    sourceAvailable: info.sourceAvailable,
    contractName: info.contractName,
    ageDays: info.ageDays,
    txCount: info.txCount,
    uniqueUsers: null,
    // TODO: requires more API calls
    isProxy: info.isProxy,
    isUpgradeable: info.isUpgradeable,
    hasSelfDestruct: info.hasSelfDestruct,
    protocol: info.protocol,
    auditStatus: "unknown",
    // TODO: integrate audit DB
    knownIssues: [],
    // TODO: integrate CVE/exploit DB
    riskLevel,
    riskScore: score,
    riskReasons: reasons
  };
}
async function isFirstInteraction(_userAddress, _contractAddress, _chain) {
  return true;
}
function formatAnalysis(analysis) {
  const icon = {
    low: "\u2705",
    medium: "\u26A0\uFE0F",
    high: "\u{1F536}",
    critical: "\u{1F6A8}"
  }[analysis.riskLevel];
  const lines = [
    `${icon} Contract Risk: ${analysis.riskLevel.toUpperCase()} (${analysis.riskScore})`,
    `   Address: ${analysis.address}`,
    `   Chain: ${analysis.chain}`,
    ""
  ];
  if (analysis.contractName) {
    lines.push(`   Name: ${analysis.contractName}`);
  }
  if (analysis.protocol) {
    lines.push(`   Protocol: ${analysis.protocol}`);
  }
  lines.push("");
  lines.push("   Risk Factors:");
  for (const reason of analysis.riskReasons) {
    const prefix = reason.startsWith("\u2713") ? "   " : "   ";
    lines.push(`${prefix}${reason}`);
  }
  return lines.join("\n");
}

export {
  getContractInfo,
  calculateRiskScore,
  scoreToLevel,
  analyzeContract,
  isFirstInteraction,
  formatAnalysis
};
//# sourceMappingURL=chunk-OFKWHJGT.js.map
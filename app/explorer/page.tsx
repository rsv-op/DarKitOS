"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import AppShell from "@/components/AppShell";
import {
  BRANDS_DB,
  KITCHENS_DB,
  type DbaBrand,
  type VirtualFileAsset,
} from "@/lib/db";

const FILE_CATEGORIES: VirtualFileAsset["category"][] =
  [
    "Architecture ADR",
    "Health Certificate",
    "SOP Manual",
    "Recipe Card",
    "Menu Photography",
    "Financial Audit",
  ];

export default function ExplorerPage() {
  const [files, setFiles] = useState<
    VirtualFileAsset[]
  >([]);
  const [categoryFilter, setCategoryFilter] =
    useState<string>("ALL");
  const [selectedFile, setSelectedFile] =
    useState<VirtualFileAsset | null>(null);
  const [notice, setNotice] = useState("");

  // Upload / Create form
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] =
    useState<VirtualFileAsset["category"]>(
      "SOP Manual",
    );
  const [newKitchenId, setNewKitchenId] =
    useState("K1");
  const [newBrandId, setNewBrandId] = useState<
    DbaBrand | ""
  >("BurgerForge");
  const [newContent, setNewContent] =
    useState("");

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/system", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.files)) {
        setFiles(data.files);
        if (
          !selectedFile &&
          data.files.length > 0
        ) {
          setSelectedFile(data.files[0]);
        }
      }
    } catch {
      // ignore
    }
  }, [selectedFile]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  async function handleSaveFile(
    e: React.FormEvent,
  ) {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await fetch("/api/system", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "UPSERT_FILE",
        file: {
          name: newName.trim(),
          category: newCategory,
          kitchenId: newKitchenId,
          brandId: newBrandId || undefined,
          content:
            newContent.trim() ||
            `# ${newName.trim()}\nOperational asset uploaded to DarKIT OS Virtual File Explorer.`,
        },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files);
      setSelectedFile(data.files[0]);
      setNewName("");
      setNewContent("");
      setNotice(
        `Uploaded asset "${newName}" to Virtual File Explorer.`,
      );
    }
  }

  async function handleDeleteFile(
    fileId: string,
  ) {
    const res = await fetch("/api/system", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "DELETE_FILE",
        fileId,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files);
      if (selectedFile?.id === fileId) {
        setSelectedFile(data.files[0] || null);
      }
      setNotice("Asset deleted from storage.");
    }
  }

  const filteredFiles = files.filter(
    (f) =>
      categoryFilter === "ALL" ||
      f.category === categoryFilter,
  );

  return (
    <AppShell
      title="Virtual File Explorer & Operational Asset Vault (/explorer)"
      subtitle="Upload, categorize, and inspect health inspection certificates, SOP manuals, recipe specs, menu photography, and Cloud7 ADRs."
    >
      <div className="space-y-6">
        {notice && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-mono text-xs text-emerald-300">
            ✓ {notice}
          </div>
        )}

        {/* Category Filter Pills */}
        <section className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setCategoryFilter("ALL")
            }
            className={`rounded-xl border px-3.5 py-2 font-mono text-xs font-bold transition ${
              categoryFilter === "ALL"
                ? "border-sky-500 bg-sky-500 text-slate-950"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
            }`}
          >
            All Assets ({files.length})
          </button>
          {FILE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() =>
                setCategoryFilter(cat)
              }
              className={`rounded-xl border px-3.5 py-2 font-mono text-xs font-bold transition ${
                categoryFilter === cat
                  ? "border-sky-500 bg-sky-500 text-slate-950"
                  : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          {/* Left: File List & Upload Form */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-sky-400 mb-3">
                Explorer Directory ({filteredFiles.length} Files)
              </h2>
              <div className="space-y-2.5">
                {filteredFiles.map((file) => {
                  const active =
                    selectedFile?.id ===
                    file.id;
                  return (
                    <div
                      key={file.id}
                      onClick={() =>
                        setSelectedFile(file)
                      }
                      className={`cursor-pointer rounded-xl border p-3.5 transition ${
                        active
                          ? "border-sky-500 bg-sky-500/10"
                          : "border-slate-800 bg-slate-950 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs font-bold text-white">
                            ▤ {file.name}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {file.category} •{" "}
                            {file.size} •{" "}
                            {file.kitchenId ||
                              "GLOBAL"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteFile(
                              file.id,
                            );
                          }}
                          className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-red-300 hover:bg-red-500/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Upload New Asset Form */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
                Upload / Create New Operational Asset (CRUD)
              </h3>
              <form
                onSubmit={handleSaveFile}
                className="mt-4 space-y-3 text-xs"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-slate-400">
                      File Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) =>
                        setNewName(
                          e.target.value,
                        )
                      }
                      placeholder="e.g. K2_Cold_Chain_SOP.md"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-slate-400">
                      Asset Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) =>
                        setNewCategory(
                          e.target
                            .value as VirtualFileAsset["category"],
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                    >
                      {FILE_CATEGORIES.map(
                        (c) => (
                          <option
                            key={c}
                            value={c}
                          >
                            {c}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-slate-400">
                      Kitchen Scope
                    </label>
                    <select
                      value={newKitchenId}
                      onChange={(e) =>
                        setNewKitchenId(
                          e.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                    >
                      {KITCHENS_DB.map((k) => (
                        <option
                          key={k.id}
                          value={k.id}
                        >
                          {k.id} • {k.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase text-slate-400">
                      Brand Tag
                    </label>
                    <select
                      value={newBrandId}
                      onChange={(e) =>
                        setNewBrandId(
                          e.target.value as
                            | DbaBrand
                            | "",
                        )
                      }
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                    >
                      <option value="">
                        All Brands
                      </option>
                      {BRANDS_DB.map((b) => (
                        <option
                          key={b.id}
                          value={b.id}
                        >
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] uppercase text-slate-400">
                    Document / Specification Content
                  </label>
                  <textarea
                    rows={4}
                    value={newContent}
                    onChange={(e) =>
                      setNewContent(
                        e.target.value,
                      )
                    }
                    placeholder="Enter SOP instructions, certificate verification metadata, or recipe specifications..."
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-sky-500 py-3 font-mono text-xs font-black uppercase text-slate-950 hover:bg-sky-400"
                >
                  + Save Asset to Explorer
                </button>
              </form>
            </section>
          </div>

          {/* Right: Spawned OS Document Viewer Window */}
          <section className="rounded-2xl border border-slate-700 bg-slate-900/90 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="font-mono text-xs font-bold text-slate-200">
                  DarKIT OS Viewer —{" "}
                  {selectedFile?.name ||
                    "No file selected"}
                </span>
              </div>
              {selectedFile && (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  {selectedFile.status}
                </span>
              )}
            </div>

            {!selectedFile ? (
              <div className="p-12 text-center text-xs text-slate-500">
                Click any file on the left to open it in the OS Viewer.
              </div>
            ) : (
              <div className="p-6 space-y-4 flex-1">
                <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500">
                      Category
                    </span>
                    <p className="font-bold text-sky-300">
                      {selectedFile.category}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">
                      Uploaded By
                    </span>
                    <p className="font-bold text-white">
                      {selectedFile.uploadedBy}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">
                      MIME / Size
                    </span>
                    <p className="font-bold text-emerald-300">
                      {selectedFile.mimeType} •{" "}
                      {selectedFile.size}
                    </p>
                  </div>
                </div>

                <pre className="whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 overflow-x-auto">
                  {selectedFile.content}
                </pre>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

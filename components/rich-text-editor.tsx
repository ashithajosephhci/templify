"use client"

import { useEffect, useMemo, useRef } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Table from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import { Button } from "@/components/ui/button"

import { type TiptapDoc } from "@/lib/tiptap-utils"

interface RichTextEditorProps {
  value: TiptapDoc
  onChange: (value: TiptapDoc) => void
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Underline,
      TextAlign.configure({
        types: ["paragraph", "heading"],
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as TiptapDoc)
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[360px] focus:outline-none",
      },
      handlePaste(view, event) {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile()
            if (!file) continue
            const reader = new FileReader()
            reader.onload = () => {
              const src = String(reader.result || "")
              if (!src) return
              view.dispatch(view.state.tr)
              editor
                ?.chain()
                .focus()
                .setImage({ src })
                .run()
            }
            reader.readAsDataURL(file)
            return true
          }
        }
        return false
      },
      handleDrop(view, event) {
        const file = event.dataTransfer?.files?.[0]
        if (!file || !file.type.startsWith("image/")) return false
        const reader = new FileReader()
        reader.onload = () => {
          const src = String(reader.result || "")
          if (!src) return
          editor?.chain().focus().setImage({ src }).run()
        }
        reader.readAsDataURL(file)
        return true
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getJSON()
    if (JSON.stringify(current) !== JSON.stringify(value)) {
      editor.commands.setContent(value)
    }
  }, [editor, value])

  const toolbar = useMemo(() => {
    return (
      <div className="flex flex-wrap gap-2 border-b border-border bg-muted/30 p-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Image
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
              const src = String(reader.result || "")
              if (!src) return
              editor?.chain().focus().setImage({ src }).run()
            }
            reader.readAsDataURL(file)
          }}
        />
      </div>
    )
  }, [editor])

  return (
    <div className="rounded-lg border border-border bg-white shadow-sm">
      {toolbar}
      <div className="min-h-[360px] p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

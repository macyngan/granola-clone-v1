import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'

interface NoteEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

export function NoteEditor({
  content,
  onChange,
  placeholder = 'Start taking notes...'
}: NoteEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder
      })
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'tiptap prose prose-sm max-w-none focus:outline-none min-h-[200px]'
      }
    }
  })

  // Update editor content when prop changes (e.g., loading saved notes)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <EditorContent editor={editor} />
    </div>
  )
}

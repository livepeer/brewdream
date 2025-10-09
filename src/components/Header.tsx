import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Video, ExternalLink } from "lucide-react"
import { useState } from "react"

interface HeaderProps {
  isAuthenticated?: boolean
}

export function Header({ isAuthenticated = false }: HeaderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const navigate = useNavigate()

  const handleRecordClick = async () => {
    if (!isAuthenticated) {
      navigate("/login")
      return
    }

    setIsRecording(true)
    console.log("[v0] Record clip action - user authenticated")
    // TODO: Implement record functionality
    setTimeout(() => setIsRecording(false), 2000)
  }

  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-20 items-center justify-between px-6">
        {/* Logo and Brand - centered on mobile */}
        <Link to="/" className="flex items-center gap-3 md:flex-none">
          <img src="/daydream-logo.svg" alt="Daydream" className="h-8 w-auto" />
          <h2 className="text-xl font-bold text-foreground">Brewdream</h2>
        </Link>

        {/* Action Buttons - hidden on mobile */}
        <div className="hidden items-center gap-3 md:flex">
          <Button variant="outline" size="sm" asChild>
            <a href="https://daydream.live/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              Try Daydream
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 text-white hover:scale-105"
            onClick={handleRecordClick}
            disabled={isRecording}
          >
            <Video className="h-4 w-4" />
            {isRecording ? "Recording..." : "Record Clip"}
          </Button>
        </div>
      </div>
    </header>
  )
}

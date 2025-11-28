import { Link, useNavigate, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Video, ExternalLink, ArrowLeft } from "lucide-react"
import { useState } from "react"

interface HeaderProps {
  isAuthenticated?: boolean
  showBackButton?: boolean
  onBackClick?: () => void
}

export function Header({ isAuthenticated = false, showBackButton = false, onBackClick }: HeaderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const location = useLocation()

  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative z-50">
      <div className="container mx-auto flex h-20 items-center justify-between px-6">
        {/* Left section - Back Button or empty space */}
        {showBackButton && (

        <div className="flex items-center min-w-[100px]">
            <Button variant="ghost" className="bg-neutral-900 hover:bg-neutral-300"  onClick={onBackClick}>
              <ArrowLeft className="md:mr-2 h-4 w-4" />
              <span className="hidden md:block">Back</span>
            </Button>
        </div>
          )}

        {/* Center - Logo and Brand */}
        <Link to="/" className="flex items-center gap-3 absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0">
          <img src="/daydream-logo.svg" alt="Daydream" className="h-8 w-auto" />
          <h2 className="text-xl font-bold text-foreground">Brewdream</h2>
        </Link>

        {/* Right section - Action Buttons */}
        <div className="hidden items-center gap-3 md:flex min-w-[100px] justify-end">
          <Button variant="outline" size="sm" asChild>
            <a href="https://daydream.live/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              Try Daydream
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 text-white hover:scale-105"
            asChild
            disabled={isRecording}
          >
            <Link to={isAuthenticated ? "/capture" + location.search : `/login?returnUrl=${encodeURIComponent('/capture' + location.search)}`}>
              <Video className="h-4 w-4" />
              {isRecording ? "Recording..." : "Clip for Coffee"}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

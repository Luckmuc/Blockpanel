import { DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Divider, Paper, IconButton } from '@mui/material';
import TerminalIcon from '@mui/icons-material/Terminal';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

type Props = {
  onClose: () => void;
  copyExamples: () => void;
};

export default function ConsoleDocs({ onClose, copyExamples }: Props) {
  return (
    <>
      <DialogTitle sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TerminalIcon sx={{ color: '#90caf9' }} />
          <Typography variant="h6" sx={{ color: '#e6f2ff' }}>Console / Shell Usage</Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ background: 'transparent' }}>
        <Paper elevation={2} sx={{ p: 2, background: 'rgba(20,30,40,0.75)', borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ color: '#cfe8ff', mb: 1 }}>How to use</Typography>
          <Typography variant="body2" sx={{ color: '#d6eaf8', mb: 1 }}>Type a command and press Enter or click Send. Common examples:</Typography>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ background: 'rgba(0,0,0,0.45)', color: '#e0e0e0', p: 1, borderRadius: 1, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {`say Hello everyone
seed
stop
save-all
kick <player>
ban <player>
op <player>
deop <player>
whitelist add <player>`}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'start' }}>
              <IconButton color="primary" onClick={copyExamples} sx={{ mt: 0.5 }}>
                <ContentCopyIcon htmlColor="#cfe8ff" />
              </IconButton>
            </Box>
          </Box>

          <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />

          <Typography variant="subtitle2" sx={{ color: '#cfe8ff' }}>Plugin / common commands</Typography>
          <Box sx={{ background: 'rgba(0,0,0,0.35)', color: '#e0e0e0', p: 1, borderRadius: 1, fontFamily: 'monospace', whiteSpace: 'pre-wrap', mt: 1 }}>
            {`essentials: /warp <name>, /tpa <player>
worldedit: //set, //pos1, //pos2
permissions: /lp user <name> info`}
          </Box>

          <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.04)' }} />

          <Typography variant="body2" sx={{ color: '#d6eaf8', mt: 1 }}>Notes & tips:</Typography>
          <Typography variant="caption" display="block" sx={{ color: '#aebfcc' }}>- Commands are sent to the server's console. If the server is stopped, the console will be empty.</Typography>
          <Typography variant="caption" display="block" sx={{ color: '#aebfcc' }}>- This panel sends the command to the server's tmux session (if used) so it behaves like typing into the server console.</Typography>
          <Typography variant="caption" display="block" sx={{ color: '#aebfcc' }}>- If a command fails, check server logs in the Logs page or via SSH to see plugin errors.</Typography>
          <Typography variant="caption" display="block" sx={{ color: '#aebfcc' }}>- Use quoting for spaces, e.g. say "Hello world".</Typography>
        </Paper>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button startIcon={<ContentCopyIcon />} onClick={copyExamples} color="primary" variant="outlined">Copy examples</Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </>
  );
}

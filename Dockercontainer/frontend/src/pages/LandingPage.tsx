import React from "react";
import { Box, Button, Typography, Paper } from "@mui/material";
import { useNavigate } from "react-router-dom";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center", 
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f2027 0%, #2c5364 100%)",
        pt: 10,
      }}
    >
      <Paper
        elevation={10}
        sx={{
          p: 6,
          borderRadius: 4,
          background: "rgba(30,40,60,0.92)",
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
          textAlign: "center",
          maxWidth: 480,
        }}
      >
        <Typography variant="h2" sx={{ fontWeight: 800, mb: 2, color: "#fff" }}>
          Blockpanel
        </Typography>
        <Typography variant="h6" sx={{ mb: 4, color: "#b0c4de" }}>
          The Web-Panel for your Minecraft Server
        </Typography>
        <Button
          variant="contained"
          color="primary"
          size="large"
          sx={{ px: 6, py: 1.5, fontSize: 20, borderRadius: 2 }}
          onClick={() => navigate("/login")}
        >
          Login
        </Button>
      </Paper>
    </Box>
  );
};

export default LandingPage;
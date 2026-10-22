@echo off
title Adisyon - Yazici Duzelt
REM Yonetici izniyle yazici duzeltme betigini calistirir
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Yazici-Duzelt.ps1"

<p align="center">
    <img style="width:10%;" src="./public/logo.png" />
</p>

<h2 align="center"> Scenes & Schedules Generator</h2>

<h4 align="center"> A modern RCU generator with a clean yet expressive design. </h4>

<p align="center">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg"/>
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"/>
</p>

## About

A NextJS application for managing lighting scenes and schedules. This tool allows users to create, edit, and manage lighting configurations and scheduling in an intuitive interface.

## Features

- **Scene Management**: Create and configure lighting scenes with individual control over each light

  - Sequential or individual light grouping
  - Customizable light names, groups, and values
  - Support for unlimited number of lights per scene
  - Copy, edit, and delete scenes

- **Schedule Management**: Set up time-based schedules for your lighting scenes

  - Select which scenes to include in each schedule
  - Configure day-of-week activation
  - Set specific hours and minutes for schedule activation
  - Enable/disable schedules as needed

- **Code Generation**: Generate and download code for your lighting configuration
  - Automatic splitting of large scenes (>60 lights) for compatibility
  - Optimized code generation for better performance
  - Easy to download and distribute

## Technologies

- React with Hooks and Context API
- shadcn/ui component library for modern UI elements
- Optimized with memoization for better performance
- Error Boundary for robust error handling
- Lazy loading for improved performance

## Notes

- Scenes with more than 60 lights are automatically split into multiple scenes in the generated code
- Changes to scenes are reflected in schedules automatically
- The application uses local state only; no data is saved to a server

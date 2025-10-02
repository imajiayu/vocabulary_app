if (WHISPER_SDL2)
    set(TARGET whisper-stream)
    add_executable(${TARGET} stream.cpp)

    include(DefaultTargetOptions)

    target_link_libraries(${TARGET} PRIVATE common common-sdl whisper ${CMAKE_THREAD_LIBS_INIT})

    install(TARGETS ${TARGET} RUNTIME)
endif ()

# Add stream_stdin target (no SDL2 dependency)
set(TARGET_STDIN whisper-stream-stdin)
add_executable(${TARGET_STDIN} stream_stdin.cpp)

include(DefaultTargetOptions)

target_link_libraries(${TARGET_STDIN} PRIVATE common whisper ${CMAKE_THREAD_LIBS_INIT})

install(TARGETS ${TARGET_STDIN} RUNTIME)

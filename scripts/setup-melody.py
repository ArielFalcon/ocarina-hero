#!/usr/bin/env python3
"""Install the pinned local melody runtime without changing system Python."""
import hashlib
import os
import shutil
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
RUNTIME = ROOT / '.runtime-melody'
REVISION = '6d9d758f167d5fd2b56aa26da0618c4d451896b2'
DIGEST = 'd56d10ede86aaf2053fca10047e0120ccb75b05f7e55f4dcaba90a0b2be159cb'
BASIC_PITCH_REVISION = '9991303bba609a3b93089d13ec80d1d495083596'  # spotify/basic-pitch v0.4.0, Apache-2.0
BASIC_PITCH_DIGEST = '2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec'
BASIC_PITCH_PATH = 'basic_pitch/saved_models/icassp_2022/nmp.onnx'

def run(*args):
    subprocess.run(args, check=True)

def install_basic_pitch():
    target = RUNTIME / 'basic-pitch' / 'nmp.onnx'
    target.parent.mkdir(exist_ok=True)
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == BASIC_PITCH_DIGEST:
        return
    repository = RUNTIME / 'basic-pitch' / 'source.git'
    if not repository.exists():
        run('git', 'init', '--bare', '--quiet', str(repository))
    run('git', '-C', str(repository), 'fetch', '--quiet', '--depth', '1', 'https://github.com/spotify/basic-pitch.git', BASIC_PITCH_REVISION)
    data = subprocess.run(['git', '-C', str(repository), 'show', f'{BASIC_PITCH_REVISION}:{BASIC_PITCH_PATH}'], check=True, stdout=subprocess.PIPE).stdout
    if hashlib.sha256(data).hexdigest() != BASIC_PITCH_DIGEST:
        sys.exit('Basic Pitch model SHA-256 mismatch; refusing to install')
    target.write_bytes(data)

def main():
    if sys.version_info[:2] != (3, 10):
        python310 = shutil.which('python3.10')
        if not python310:
            sys.exit('Python 3.10 is required; install it and ensure python3.10 is on PATH, then rerun npm run setup:melody.')
        os.execv(python310, [python310, str(pathlib.Path(__file__).resolve()), *sys.argv[1:]])
    RUNTIME.mkdir(exist_ok=True)
    source = RUNTIME / 'source'
    if not source.exists():
        run('git', 'clone', '--no-checkout', 'https://github.com/bill317996/Melody-extraction-with-melodic-segnet.git', str(source))
    if subprocess.run(['git', '-C', str(source), 'cat-file', '-e', REVISION + '^{commit}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
        run('git', '-C', str(source), 'fetch', 'origin', REVISION)
    run('git', '-C', str(source), 'checkout', '--force', '--detach', REVISION)
    checkpoint = source / 'MSnet/pretrain_model/MSnet_melody'
    if hashlib.sha256(checkpoint.read_bytes()).hexdigest() != DIGEST:
        sys.exit('Checkpoint SHA-256 mismatch; refusing to install')
    cfp = source / 'MSnet/cfp.py'
    original = cfp.read_text()
    old = 'np.linspace(0, 0.5, np.round(N/2), endpoint=True)'
    new = 'np.linspace(0, 0.5, int(np.round(N/2)), endpoint=True)'
    if original.count(old) != 1:
        sys.exit('Unexpected upstream CFP source; refusing to patch')
    cfp.write_text(original.replace(old, new))
    install_basic_pitch()
    run(sys.executable, '-m', 'venv', str(RUNTIME / 'venv'))
    run(str(RUNTIME / 'venv/bin/python'), '-m', 'pip', 'install', '-r', str(ROOT / 'scripts/melody-requirements.txt'))
    print('Local runtime installed. Source license: .runtime-melody/source/LICENSE; checkpoint redistribution terms remain unresolved. Basic Pitch model: Apache-2.0, spotify/basic-pitch v0.4.0.')

if __name__ == '__main__':
    main()

<!-- !!! DO NOT EDIT, THIS FILE IS GENERATED AUTOMATICALLY !!!  -->

> :information_source: Please, see the full project documentation here: [https://softvisio.github.io/psqls/](https://softvisio.github.io/psqls/).

# Introduction

SSL / TLS wrapper for `psql`.

Allows for `psql` to connect to the `PostgreSQL` server over SSL tunnel. Can be used when `PostgreSQL` server is located behind the `SSL` load balancer.

## Install

```shell
npm i --location=global @softvisio/psqls
```

## Usage

Usage is the same as for original `psql`.

For tunneled connections is sets `REAL_HOST` variable, which can be used in your `.psqlrc` as following:

```text
\if :{?REAL_HOST}
    \set PROMPT1 '[pg://%x%[%033[1;31m%]%n%[%033[0;31m%]@%[%033[1;31m%]%:REAL_HOST:%[%033[0;31m%]/%[%033[0;37m%]%/]%[%033[1;33m%]%#%[%033[0m%] '
\else
    \set PROMPT1 '[pg://%x%[%033[1;31m%]%n%[%033[0;31m%]@%[%033[1;31m%]%M%[%033[0;31m%]/%[%033[0;37m%]%/]%[%033[1;33m%]%#%[%033[0m%] '
\endif
```
